import React from "react";
import { Edit2, Trash2 } from "lucide-react";

export default function NoteItem({ note, onOpenNote, onDelete, disabled }) {
  const date = new Date(note.timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="bg-gray-800 rounded-2xl p-5 border border-gray-700 hover:border-gray-600 transition-colors group flex flex-col h-full shadow-lg cursor-pointer"
      onClick={() => {
        if (!disabled) {
          onOpenNote(note);
        }
      }}
    >
      <div className="flex-1">
        <p className="text-gray-200 whitespace-pre-wrap break-words leading-relaxed line-clamp-3">
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
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>
    </div>
  );
}
