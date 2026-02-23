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

  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

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
      const tx = await contract.createNote(payload, category, tags);
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
      const tx = await contract.updateNote(id, payload, category, tags);
      await tx.wait();
      await fetchNotes();
    } catch (error) {
      console.error("Error updating note:", error);
      setError("Failed to update note. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const deleteNote = async (id) => {
    if (!contract) return;
    try {
      setLoading(true);
      const tx = await contract.deleteNote(id);
      await tx.wait();
      await fetchNotes();
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
            {error}
          </div>
        )}

        {account ? (
          <div className="grid grid-cols-1 md:grid-cols-[260px,1fr] gap-8">
            <aside className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-4 h-fit">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">
                Filter by Category
              </h3>
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

              <h3 className="text-sm font-semibold text-gray-200 mb-2">
                Search by Tag
              </h3>
              <input
                type="text"
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder="Type a tag name..."
                className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </aside>

            <div className="space-y-8">
              <NoteForm onAdd={addNote} disabled={loading} />

              {loading && filteredNotes.length === 0 ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : (
                <NoteList
                  notes={filteredNotes}
                  onUpdate={updateNote}
                  onDelete={deleteNote}
                  disabled={loading}
                />
              )}
            </div>
          </div>
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
