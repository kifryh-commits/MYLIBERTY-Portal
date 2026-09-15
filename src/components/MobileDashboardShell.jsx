import { useState } from "react";

function tabText(label = "") {
  // Labels include helpful emoji. Keep them, but derive a readable page title
  // without depending on a particular dashboard's wording.
  return label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

/**
 * Phone-only presentation for DashboardShell.
 *
 * It deliberately receives the same tabs and callbacks as the desktop shell,
 * so this component changes navigation appearance only. Dashboard data,
 * permissions and individual tab components stay shared between phone and
 * desktop views.
 */
export default function MobileDashboardShell({ tabs, activeTab, onTabChange, title, extraSidebarContent }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleTabs = tabs.filter(tab => !tab.hidden);
  const primaryTabs = visibleTabs.slice(0, 4);
  const moreTabs = visibleTabs.slice(4);
  const active = visibleTabs.find(tab => tab.id === activeTab);
  const activeIsInMore = moreTabs.some(tab => tab.id === activeTab);

  const selectTab = (tabId) => {
    onTabChange(tabId);
    setMoreOpen(false);
  };

  return (
    <div className="md:hidden">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1a3a8f]">{title || "MYLIBERTY"}</p>
        <h2 className="mt-0.5 text-lg font-black text-slate-800">{tabText(active?.label) || "Dashboard"}</h2>
        {extraSidebarContent && <div className="mt-3">{extraSidebarContent}</div>}
      </div>

      <main className="pb-24">{active?.component}</main>

      {moreOpen && (
        <>
          <button
            aria-label="Close navigation menu"
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/35"
          />
          <section className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />
            <h3 className="mb-3 text-base font-black text-slate-800">More tools</h3>
            <div className="grid grid-cols-2 gap-2">
              {moreTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => selectTab(tab.id)}
                  className={`min-h-14 rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                    activeTab === tab.id
                      ? "border-[#1a3a8f] bg-[#1a3a8f] text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 active:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-6px_20px_rgba(15,23,42,0.08)]">
        {primaryTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            className={`min-h-14 min-w-0 flex-1 rounded-xl px-1 text-center text-[10px] font-bold leading-tight transition ${
              activeTab === tab.id ? "bg-blue-50 text-[#1a3a8f]" : "text-slate-500 active:bg-slate-50"
            }`}
          >
            <span className="block truncate">{tab.label}</span>
          </button>
        ))}
        {moreTabs.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className={`min-h-14 min-w-0 flex-1 rounded-xl px-1 text-center text-[10px] font-bold transition ${
              activeIsInMore || moreOpen ? "bg-blue-50 text-[#1a3a8f]" : "text-slate-500 active:bg-slate-50"
            }`}
          >
            <span className="block text-base leading-none">•••</span>
            <span className="block mt-1">More</span>
          </button>
        )}
      </nav>
    </div>
  );
}
