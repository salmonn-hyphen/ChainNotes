import React from "react";

export default function Spinner() {
  return (
    <div className="relative w-8 h-8">
      <div className="absolute inset-0 rounded-full border-2 border-gray-700"></div>
      <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
    </div>
  );
}
