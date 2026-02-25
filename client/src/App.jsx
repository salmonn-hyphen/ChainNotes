import React, { useState, useEffect } from "react";
import { BrowserProvider, Contract } from "ethers";
import CryptoJS from "crypto-js";
import ChainNotesABI from "./contracts/ChainNotes.json";
import NoteForm from "./components/NoteForm";
import NoteList from "./components/NoteList";
import Spinner from "./components/Spinner";
import { uploadTextToIPFS, fetchTextFromIPFS, hasIPFSSupport } from "./ipfs";
import { Wallet, Lock, RefreshCw } from "lucide-react";

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [notes, setNotes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [tagQuery, setTagQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("home"); // "home" = last 3 notes, "all" = full list

  const [allNotesPage, setAllNotesPage] = useState(1);

  const [editingNote, setEditingNote] = useState(null);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editTagsInput, setEditTagsInput] = useState("");

  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

  useEffect(() => {
    if (editingNote) {
      setEditContent(editingNote.content || "");
      setEditCategory(editingNote.category || "");
      setEditTagsInput((editingNote.tags || []).join(", "));
      setIsEditingMode(false); // Default to view mode when opening
    }
  }, [editingNote]);

  useEffect(() => {
    // Reset pagination when filters, notes, or view change
    if (view === "all") {
      setAllNotesPage(1);
    }
  }, [selectedCategory, tagQuery, notes, view]);

  const checkIfWalletIsConnected = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        console.log("Make sure you have metamask!");
        return;
      }

      const accounts = await ethereum.request({ method: "eth_accounts" });
      if (accounts.length !== 0) {
        const account = accounts[0];
        setAccount(account);
        setupContract(ethereum);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRefreshAccount = async () => {
    // Re-run the wallet/account + contract setup flow so that
    // any account changes in MetaMask are reflected in the UI
    setError("");
    await checkIfWalletIsConnected();
  };

  const deriveEncryptionKey = async (signer) => {
    // Deterministic message so the same wallet always derives the same key
    const message = "ChainNotes Encryption Key v1";
    const signature = await signer.signMessage(message);
    // AES-256 key derived from the signature using SHA-256
    const key = CryptoJS.SHA256(signature).toString();
    setEncryptionKey(key);
    return key;
  };

  const connectWallet = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        alert("Get MetaMask!");
        return;
      }
      setError("");
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      setAccount(accounts[0]);
      setupContract(ethereum);
    } catch (error) {
      console.error(error);
    }
  };

  const setupContract = async (ethereum) => {
    try {
      setError("");
      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      // Derive per-user encryption key from a signature
      const key = await deriveEncryptionKey(signer);

      // Get network to find the correct contract address from ABI
      const network = await provider.getNetwork();
      // Ganache CLI uses 1337, GUI uses 5777. Truffle uses 5777 by default for development.
      // If the network is 1337 (Ganache CLI default), we map it to 5777 to match Truffle's default network ID.
      let networkId = network.chainId.toString();
      if (networkId === "1337") {
        networkId = "5777";
      }

      const deployedNetwork = ChainNotesABI.networks[networkId];
      if (!deployedNetwork) {
        setError(
          "Contract not deployed to the current network. Please switch to Ganache/Sepolia.",
        );
        return;
      }

      const chainNotesContract = new Contract(
        deployedNetwork.address,
        ChainNotesABI.abi,
        signer,
      );

      setContract(chainNotesContract);
      // Use freshly derived key for the initial fetch
      fetchNotes(chainNotesContract, key);
    } catch (err) {
      console.error("Error setting up contract:", err);
      setError("Failed to setup contract. Check console for details.");
    }
  };

  const fetchNotes = async (
    chainNotesContract = contract,
    key = encryptionKey,
  ) => {
    if (!chainNotesContract) return;
    try {
      setLoading(true);
      const userNotes = await chainNotesContract.getUserNotes();

      const ipfsEnabled = hasIPFSSupport();

      const formattedNotes = (
        await Promise.all(
          userNotes.map(async (note) => {
            const stored = note.content; // either CID (IPFS) or encrypted text
            let content = "";

            if (key) {
              // First, try to decrypt the stored value directly (no IPFS case)
              let directDecrypted = "";
              try {
                const bytes = CryptoJS.AES.decrypt(stored, key);
                directDecrypted = bytes.toString(CryptoJS.enc.Utf8);
              } catch (e) {
                directDecrypted = "";
              }

              if (directDecrypted) {
                content = directDecrypted;
              } else if (ipfsEnabled) {
                // Treat stored value as CID pointing to encrypted payload
                try {
                  const encryptedText = await fetchTextFromIPFS(stored);
                  const bytes = CryptoJS.AES.decrypt(encryptedText, key);
                  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                  if (decrypted) {
                    content = decrypted;
                  } else {
                    content = "[Unable to decrypt note with current key]";
                  }
                } catch (fetchErr) {
                  console.error("Failed to fetch from IPFS", fetchErr);
                  content = "[Failed to load note from IPFS]";
                }
              } else {
                content = "[Unable to decrypt note with current key]";
              }
            } else {
              // No key yet – show raw stored value
              content = stored;
            }

            return {
              id: Number(note.id),
              content,
              timestamp: Number(note.timestamp),
              owner: note.owner,
              category: note.category,
              tags: note.tags || [],
            };
          }),
        )
      ).reverse(); // Newest first

      setNotes(formattedNotes);
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async (content, category, tags) => {
    if (!contract) return;
    if (!encryptionKey) {
      setError("Encryption key not initialized. Please reconnect your wallet.");
      return;
    }
    try {
      setError("");
      setLoading(true);
      const encrypted = CryptoJS.AES.encrypt(content, encryptionKey).toString();

      let cid = null;
      try {
        cid = await uploadTextToIPFS(encrypted);
      } catch (ipfsErr) {
        console.error(
          "IPFS upload failed, falling back to on-chain storage",
          ipfsErr,
        );
      }

      const payload = cid || encrypted;
      // Defaulting isPublic to false for now, until UI supports it
      const tx = await contract.createNote(payload, category, tags, false);
      await tx.wait();
      await fetchNotes();
    } catch (error) {
      console.error("Error adding note:", error);
      setError("Failed to create note. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const updateNote = async (id, newContent, category, tags) => {
    if (!contract) return;
    if (!encryptionKey) {
      setError("Encryption key not initialized. Please reconnect your wallet.");
      return;
    }
    try {
      setError("");
      setLoading(true);
      const encrypted = CryptoJS.AES.encrypt(
        newContent,
        encryptionKey,
      ).toString();

      let cid = null;
      try {
        cid = await uploadTextToIPFS(encrypted);
      } catch (ipfsErr) {
        console.error(
          "IPFS upload failed, falling back to on-chain storage",
          ipfsErr,
        );
      }

      const payload = cid || encrypted;
      const tx = await contract.updateNote(id, payload, category, tags, false);
      await tx.wait();
      await fetchNotes();
    } catch (error) {
      console.error("Error updating note:", error);
      setError("Failed to update note. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEditedNote = () => {
    if (!editingNote) return;

    const trimmedContent = editContent.trim();
    const trimmedCategory = editCategory.trim();
    const tags = editTagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (
      trimmedContent !== editingNote.content ||
      trimmedCategory !== (editingNote.category || "") ||
      tags.join(",") !== (editingNote.tags || []).join(",")
    ) {
      updateNote(editingNote.id, trimmedContent, trimmedCategory, tags);
    }

    setEditingNote(null);
  };

  const deleteNote = async (id) => {
    if (!contract) return;
    try {
      setLoading(true);
      const tx = await contract.deleteNote(id);
      await tx.wait();
      await fetchNotes();
      setEditingNote(null);
    } catch (error) {
      console.error("Error deleting note:", error);
    } finally {
      setLoading(false);
    }
  };

  const normalizedTagQuery = tagQuery.trim().toLowerCase();

  const filteredNotes = notes.filter((note) => {
    const matchesCategory =
      selectedCategory === "All" ||
      !selectedCategory ||
      (note.category || "").toLowerCase() === selectedCategory.toLowerCase();

    const matchesTag =
      !normalizedTagQuery ||
      (note.tags || []).some((tag) =>
        tag.toLowerCase().includes(normalizedTagQuery),
      );

    return matchesCategory && matchesTag;
  });

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / pageSize));
  const currentPage = Math.min(allNotesPage, totalPages);
  const paginatedNotes = filteredNotes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const latestNotes = notes.slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-indigo-500 selection:text-white">
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20">
              C
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              ChainNotes
            </span>
            <div className="hidden sm:flex items-center gap-1 text-xs text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
              <Lock size={14} />
              <span>AES-256 encrypted</span>
            </div>
          </div>

          {!account ? (
            <button
              onClick={connectWallet}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-all font-medium text-sm shadow-lg shadow-indigo-500/20"
            >
              <Wallet size={16} />
              Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-300">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
              <button
                onClick={handleRefreshAccount}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-100 transition-colors"
                title="Refresh account from MetaMask"
                disabled={loading}
              >
                <RefreshCw size={16} />
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm">{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="ml-4 text-red-300 hover:text-red-100 hover:bg-red-500/20 rounded-full px-2 py-1 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {account ? (
          view === "home" ? (
            <div className="space-y-8">
              <h2 className="text-xl font-semibold text-white">Recent Notes</h2>

              <NoteForm onAdd={addNote} disabled={loading} />

              {loading && latestNotes.length === 0 ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : (
                <NoteList
                  notes={latestNotes}
                  onDelete={deleteNote}
                  disabled={loading}
                  onOpenNote={setEditingNote}
                />
              )}

              {notes.length > 3 && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => setView("all")}
                    className="text-sm font-medium text-indigo-400 hover:text-indigo-300 px-4 py-2 rounded-lg hover:bg-indigo-500/10 border border-indigo-500/40 transition-colors"
                  >
                    See all notes
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <button
                onClick={() => setView("home")}
                className="text-sm font-medium text-gray-300 hover:text-white px-3 py-1 rounded-lg hover:bg-gray-700/70 border border-transparent hover:border-gray-600 transition-colors"
              >
                ← Back to recent
              </button>

              <div className="grid grid-cols-1 md:grid-cols-[260px,1fr] gap-8">
                <aside className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-4 h-fit mt-2">
                  <h3 className="text-sm font-semibold text-gray-200 mb-4">
                    Filter &amp; Search
                  </h3>

                  <h4 className="text-xs font-semibold text-gray-400 mb-2">
                    Category
                  </h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      "All",
                      ...Array.from(
                        new Set(
                          notes
                            .map((n) => (n.category || "").trim())
                            .filter((c) => c.length > 0),
                        ),
                      ),
                    ].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${selectedCategory === cat ? "bg-indigo-600 text-white border-indigo-500" : "bg-gray-900/60 text-gray-300 border-gray-700 hover:bg-gray-700/60"}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <h4 className="text-xs font-semibold text-gray-400 mb-2">
                    Search by Tag
                  </h4>
                  <input
                    type="text"
                    value={tagQuery}
                    onChange={(e) => setTagQuery(e.target.value)}
                    placeholder="Type a tag name..."
                    className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </aside>

                <div className="space-y-8">
                  <h2 className="text-xl font-semibold text-white">
                    All Notes
                  </h2>

                  {loading && filteredNotes.length === 0 ? (
                    <div className="flex justify-center py-12">
                      <Spinner />
                    </div>
                  ) : (
                    <NoteList
                      notes={paginatedNotes}
                      onDelete={deleteNote}
                      disabled={loading}
                      onOpenNote={setEditingNote}
                      fullWidth
                    />
                  )}

                  {filteredNotes.length > pageSize && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                      <span className="text-xs text-gray-400">
                        Page {currentPage} of {totalPages}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() =>
                            setAllNotesPage((p) => Math.max(1, p - 1))
                          }
                          className="px-3 py-1 rounded-lg text-xs border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700/70 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() =>
                            setAllNotesPage((p) => Math.min(totalPages, p + 1))
                          }
                          className="px-3 py-1 rounded-lg text-xs border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700/70 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-20">
            <h2 className="text-3xl font-bold text-white mb-4">
              Decentralized Note Taking
            </h2>
            <p className="text-gray-400 max-w-md mx-auto mb-8">
              Secure, immutable, and censorship-resistant notes stored directly
              on the blockchain. Connect your wallet to get started.
            </p>
          </div>
        )}
      </main>

      {editingNote && (
        <div
          className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setEditingNote(null)}
        >
          <div
            className="bg-gray-900 rounded-2xl border border-gray-700 max-w-xl w-full mx-4 p-6 shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">
                  {isEditingMode ? "Edit Note" : "Note Details"}
                </h2>
                <p className="text-xs text-gray-500">
                  {new Date(editingNote.timestamp * 1000).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="text-gray-400 hover:text-gray-200 hover:bg-gray-700/70 rounded-full p-1 transition-colors"
              >
                ✕
              </button>
            </div>

            {isEditingMode ? (
              // EDIT MODE
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-gray-900/60 text-gray-100 rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[160px] border border-gray-700 font-sans"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="Category"
                    className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    value={editTagsInput}
                    onChange={(e) => setEditTagsInput(e.target.value)}
                    placeholder="Tags (comma separated)"
                    className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ) : (
              // VIEW MODE
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative">
                <div className="text-gray-200 whitespace-pre-wrap leading-relaxed text-base break-words min-h-[100px]">
                  {editingNote.content}
                </div>

                {(editingNote.category || editingNote.tags.length > 0) && (
                  <div className="mt-6 pt-4 border-t border-gray-800 flex flex-wrap gap-2">
                    {editingNote.category && (
                      <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded text-xs">
                        {editingNote.category}
                      </span>
                    )}
                    {editingNote.tags.map((t) => (
                      <span
                        key={t}
                        className="bg-gray-800 text-gray-400 border border-gray-700 px-2 py-1 rounded text-xs"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-800 flex-shrink-0">
              {isEditingMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditingMode(false)}
                    className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-700/70 border border-transparent hover:border-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditedNote}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
                  >
                    Save Changes
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => deleteNote(editingNote.id)}
                    className="px-4 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent transition-colors mr-auto"
                  >
                    Delete Note
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingNote(null)}
                    className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 border border-transparent transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingMode(true)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-2"
                  >
                    Edit Note
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Loading Overlay for Transactions */}
      {loading && notes.length > 0 && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-sm font-medium text-gray-300">
              Confirming transaction...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
