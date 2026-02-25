import React, { useState } from "react";
import { Plus } from "lucide-react";

export default function NoteForm({ onAdd, disabled }) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    const trimmedCategory = category.trim();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onAdd(trimmedContent, trimmedCategory, tags);

    setContent("");
    setCategory("");
    setTagsInput("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-800 rounded-2xl p-4 border border-gray-700 shadow-lg space-y-3"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        className="w-full bg-transparent text-gray-100 placeholder-gray-500 resize-none focus:outline-none min-h-[100px] p-2"
        disabled={disabled}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (optional)"
          className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={disabled}
        />
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Tags (comma separated)"
          className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={disabled}
        />
      </div>

      <div className="flex justify-end mt-2 pt-2 border-t border-gray-700/50">
        <button
          type="submit"
          disabled={disabled || !content.trim()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-5 py-2 rounded-lg transition-all font-medium text-sm"
        >
          <Plus size={16} />
          Create Note
        </button>
      </div>
    </form>
  );
}
