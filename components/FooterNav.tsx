"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Heart, Plus, Settings } from "lucide-react";

export default function FooterNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "本棚", icon: BookOpen },
    { href: "/wants", label: "欲しい本", icon: Heart },
    { href: "/add", label: "登録", icon: Plus },
    { href: "/settings", label: "設定・CSV", icon: Settings },
  ];

  return (
    <nav aria-label="メインナビゲーション" className="fixed bottom-0 left-0 right-0 z-30 bg-paper-card/95 backdrop-blur-md border-t border-paper-border px-2 py-2 shadow-lg">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1 text-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 transition ${
                isActive
                  ? "text-paper-caramel font-bold"
                  : "text-paper-text-sub hover:text-paper-text-main font-medium"
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}