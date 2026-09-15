import { useState } from "react";

/**
 * tabs: [{ id, label, component, hidden? }]
 *   - `hidden: true` renders the tab's content when active but skips its
 *     sidebar button — for screens only reachable programmatically (e.g. an
 *     edit form opened via an "Edit" button elsewhere, not a nav destination).
 *
 * Uncontrolled (original behavior, still used by ManagerDashboard /
 * InstructorDashboard unchanged): pass just `tabs` (+ optional `defaultTab`)
 * and the shell owns its own active-tab state internally.
 *
 * Controlled (used by AdminDashboard / FrontOfficeDashboard): pass
 * `activeTab` + `onTabChange` so the parent owns the state. This is what
 * lets a button *inside* one tab's content (e.g. an Overview "Manage
 * classes" shortcut) jump to a different tab.
 *
 * `title`: optional heading shown above the tab list (hidden on mobile),
 * e.g. "Admin Panel" vs "Front Office" — lets two dashboards share this
 * exact shell while still visually identifying which one you're in.
 *
 * `extraSidebarContent`: optional node rendered above the tab buttons, for
 * something like Front Office's "Launch Reception Mode" button that isn't
 * a tab at all.
 */
export default function DashboardShell({ tabs, defaultTab, activeTab: controlledActiveTab, onTabChange, title, extraSidebarContent }) {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab || tabs[0]?.id);
  const isControlled = controlledActiveTab !== undefined;
  const activeTab = isControlled ? controlledActiveTab : internalActiveTab;
  const setActiveTab = isControlled ? onTabChange : setInternalActiveTab;

  const active = tabs.find(t => t.id === activeTab);

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Sidebar */}
      <div className="w-full md:w-1/4 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
        {title && <h2 className="text-xl font-bold text-[#1a3a8f] mb-2 hidden md:block">{title}</h2>}
        {extraSidebarContent}
        {tabs.filter(tab => !tab.hidden).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-2.5 rounded-lg text-left font-semibold text-xs whitespace-nowrap transition ${
              activeTab === tab.id ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-gray-700 border hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="w-full md:w-3/4">
        {active?.component}
      </div>
    </div>
  );
}
