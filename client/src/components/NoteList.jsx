import React from "react";
import NoteItem from "./NoteItem";

export default function NoteList({
  notes,
  onDelete,
  disabled,
  onOpenNote,
  fullWidth = false,
}) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-800/50 rounded-2xl border border-gray-700/50 border-dashed">
        <p className="text-gray-400">
          No notes yet. Create your first one above!
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        fullWidth
          ? "space-y-4" // single column, full-width list
          : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      }
    >
      {notes.map((note) => (
        <NoteItem
          key={note.id}
          note={note}
          onDelete={onDelete}
          disabled={disabled}
          onOpenNote={onOpenNote}
        />
      ))}
    </div>
  );
}
