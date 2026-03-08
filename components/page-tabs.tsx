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
  return (
    <nav aria-label="Sektionsflikar" className="page-tabs">
      {tabs.map((tab) => (
        <Link
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
