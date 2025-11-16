// components/SubcategorySelector.tsx

"use client";

import React from "react";

interface SubcategorySelectorProps {
  subcategories: string[];
  onSelect: (subcategory: string) => void;
}

export default function SubcategorySelector({
  subcategories,
  onSelect,
}: SubcategorySelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      {subcategories.map((sub) => (
        <button
          key={sub}
          onClick={() => onSelect(sub)}
          className="
            w-full
            text-left
            px-4 py-3
            rounded-xl
            border border-[#F3C58C]
            bg-[#FFF9F2]
            text-[#5C3B1F]
            font-medium
            shadow-[0_1px_4px_rgba(0,0,0,0.05)]
            hover:bg-white
            transition
          "
        >
          {sub}
        </button>
      ))}
    </div>
  );
}
