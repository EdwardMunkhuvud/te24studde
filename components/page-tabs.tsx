"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export type PageTabItem = {
  key: string;
  label: string;
  badge?: number | string | null;
};

type PageTabsProps = {
  activeTab: string;
  basePath: string;
  tabs: PageTabItem[];
};

export function PageTabs({ activeTab, basePath, tabs }: PageTabsProps) {
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const container = navigation.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !active) return;
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.left < containerRect.left) container.scrollLeft -= containerRect.left - activeRect.left + 4;
    else if (activeRect.right > containerRect.right) container.scrollLeft += activeRect.right - containerRect.right + 4;
  }, [activeTab]);

  return (
    <nav ref={navigation} aria-label="Sektionsflikar" className="page-tabs">
      {tabs.map((tab) => (
        <Link
          aria-current={activeTab === tab.key ? "page" : undefined}
          className={`page-tab ${activeTab === tab.key ? "active" : ""}`}
          href={`${basePath}?tab=${tab.key}`}
          key={tab.key}
          scroll={false}
        >
          <span>{tab.label}</span>
          {tab.badge ? <strong>{tab.badge}</strong> : null}
        </Link>
      ))}
    </nav>
  );
}
