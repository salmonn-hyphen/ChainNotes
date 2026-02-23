import React, { useState } from "react";
import { Edit2, Trash2, X, Check } from "lucide-react";

export default function NoteItem({ note, onUpdate, onDelete, disabled }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [editCategory, setEditCategory] = useState(note.category || "");
  const [editTagsInput, setEditTagsInput] = useState(
    (note.tags || []).join(", "),
  );

  const handleUpdate = () => {
    const trimmedContent = editContent.trim();
    const trimmedCategory = editCategory.trim();
    const tags = editTagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (
      trimmedContent !== note.content ||
      trimmedCategory !== (note.category || "") ||
      tags.join(",") !== (note.tags || []).join(",")
    ) {
      onUpdate(note.id, trimmedContent, trimmedCategory, tags);
    }
    setIsEditing(false);
  };

  const date = new Date(note.timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 hover:border-gray-600 transition-colors group flex flex-col h-full shadow-lg">
      {isEditing ? (
        <div className="flex-1 flex flex-col gap-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full bg-gray-900/50 text-gray-100 rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-h-[120px] border border-gray-700"
            autoFocus
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

          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditContent(note.content);
              }}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
            <button
              onClick={handleUpdate}
              className="p-2 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded-lg transition-colors"
            >
              <Check size={16} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1">
            <p className="text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
              {note.content}
            </p>
            {(note.category || (note.tags || []).length > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {note.category && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/40">
                    {note.category}
                  </span>
                )}
                {(note.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded-full bg-gray-700 text-gray-200 border border-gray-600"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
            <span className="text-xs text-gray-500 font-medium">{date}</span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setIsEditing(true)}
                disabled={disabled}
                className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors disabled:opacity-50"
                title="Edit Note"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => onDelete(note.id)}
                disabled={disabled}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                title="Delete Note"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
