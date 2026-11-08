"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, PlusCircle, StickyNote, Settings } from "lucide-react";

export default function FooterNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "本棚", icon: BookOpen },
    { href: "/add", label: "登録", icon: PlusCircle },
    { href: "/want", label: "ノート", icon: StickyNote }, // 🟢 StickyNote に変更
    { href: "/settings", label: "設定", icon: Settings },
  ];

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 bg-paper-card/95 backdrop-blur-md border-t border-paper-border py-2 px-4 shadow-lg">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 text-xs font-bold transition px-3 py-1 rounded ${
                isActive
                  ? "text-paper-caramel bg-paper-sub border border-paper-border/60"
                  : "text-paper-text-sub hover:text-paper-text-main"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </footer>
  );
}