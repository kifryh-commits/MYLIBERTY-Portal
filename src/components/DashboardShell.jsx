import { useState } from "react";

// tabs: [{ id, label, component: <Component /> }]
export default function DashboardShell({ tabs, defaultTab }) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const active = tabs.find(t => t.id === activeTab);

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Sidebar */}
      <div className="w-full md:w-1/4 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
        {tabs.map(tab => (
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
