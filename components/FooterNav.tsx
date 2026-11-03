"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, PlusCircle, Heart, Settings } from "lucide-react";

export default function FooterNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "本棚", icon: BookOpen },
    { href: "/add", label: "登録", icon: PlusCircle },
    { href: "/want", label: "欲しい本", icon: Heart },
    { href: "/settings", label: "設定", icon: Settings },
  ];

  return (
    <nav aria-label="フッターナビゲーション" className="fixed bottom-0 left-0 right-0 z-40 bg-paper-card/95 backdrop-blur-md border-t border-paper-border shadow-md">
      <div className="max-w-md mx-auto flex items-center justify-around py-2 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition cursor-pointer ${
                isActive
                  ? "text-paper-caramel font-bold scale-105"
                  : "text-paper-text-sub hover:text-paper-text-main"
              }`}
            >
              <Icon className={`w-5 h-5 ${item.href === "/want" && isActive ? "fill-paper-caramel" : ""}`} />
              <span className="text-[10px] tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}