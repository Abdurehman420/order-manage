import "./App.css";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatDistanceToNow, format } from "date-fns";
import React from "react";
import {
  BellIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
  PrinterIcon,
  DownloadIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/outline";

// ---------- Utilities ----------
const uid = (prefix = "ord") => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

// Default menu (will be persisted)
const defaultMenu = [{ id: "m1", name: "chicken tikka ", price: 250 }];

const statuses = ["Pending", "Preparing", "Ready", "Delivered", "Canceled"];

// ---------- Main Component (default export) ----------
export default function RestaurantOrdersDashboard() {
  // Menu state (persisted)
  const [menu, setMenu] = useState(() => {
    try {
      const raw = localStorage.getItem("menu_demo_v1");
      return raw ? JSON.parse(raw) : defaultMenu;
    } catch (e) {
      return defaultMenu;
    }
  });

  // Shop info (persisted)
  const [shopInfo, setShopInfo] = useState(() => {
    try {
      const raw = localStorage.getItem("shop_info_v1");
      return raw ? JSON.parse(raw) : { name: "My Restaurant", address: "", phone: "", taxNumber: "" };
    } catch (e) {
      return { name: "My Restaurant", address: "", phone: "", taxNumber: "" };
    }
  });

  const [orders, setOrders] = useState(() => {
    try {
      const raw = localStorage.getItem("orders_demo_v1");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  // --- Completed orders state (persisted) ---
  const [completedOrders, setCompletedOrders] = useState(() => {
    try {
      const raw = localStorage.getItem("completed_orders_v1");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("completed_orders_v1", JSON.stringify(completedOrders));
  }, [completedOrders]);

  function addCompleted(order) {
    // avoid duplicates
    setCompletedOrders((prev) => {
      if (prev.some((o) => o.id === order.id)) return prev;
      const record = { ...order, completedAt: new Date().toISOString() };
      return [record, ...prev];
    });
  }

  function removeCompleted(id) {
    setCompletedOrders((prev) => prev.filter((o) => o.id !== id));
  }

  function clearCompleted() {
    // optional confirmation
    if (!window.confirm("Clear all completed orders?")) return;
    setCompletedOrders([]);
  }

  function getDayKey(timestamp) {
    // returns YYYY-MM-DD string for grouping
    return format(new Date(timestamp), "yyyy-MM-dd");
  }

  function removeCompletedDay(dayKey) {
    // remove all completed orders whose completedAt falls on dayKey
    setCompletedOrders((prev) => prev.filter((o) => getDayKey(o.completedAt) !== dayKey));
  }

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState(null);
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [shopModalOpen, setShopModalOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 6;

  useEffect(() => {
    localStorage.setItem("orders_demo_v1", JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem("menu_demo_v1", JSON.stringify(menu));
  }, [menu]);

  useEffect(() => {
    localStorage.setItem("shop_info_v1", JSON.stringify(shopInfo));
  }, [shopInfo]);

  // Toast helper
  function notify(message, ms = 3500) {
    setToast(message);
    setTimeout(() => setToast(null), ms);
  }

  // CRUD helpers
  const upsertOrder = (order) => {
    setOrders((s) => {
      const idx = s.findIndex((o) => o.id === order.id);
      if (idx === -1) {
        // new order
        if (order.status === "Delivered") addCompleted(order);
        return [order, ...s];
      }
      const copy = [...s];
      const prev = copy[idx];
      copy[idx] = order;
      // if status changed to Delivered, record it
      if (prev?.status !== order.status && order.status === "Delivered") {
        addCompleted(order);
      }
      return copy;
    });
    notify(`Order ${order.id} saved`);
  };

  const deleteOrder = (id) => {
    setOrders((s) => s.filter((o) => o.id !== id));
    notify(`Order ${id} deleted`);
  };

  // Menu management
  const addMenuItem = (item) => setMenu((s) => [{ ...item, id: uid("m") }, ...s]);
  const updateMenuItem = (id, patch) => setMenu((s) => s.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const deleteMenuItem = (id) => setMenu((s) => s.filter((m) => m.id !== id));

  // Filters and search
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => (statusFilter === "All" ? true : o.status === statusFilter))
      .filter((o) => (typeFilter === "All" ? true : o.type === typeFilter))
      .filter((o) => {
        if (!q) return true;
        return (
          o.id.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.items.some((it) => it.name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, query, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  // Analytics data for the last 8 buckets (demo)
  const analytics = useMemo(() => {
    const map = {};
    for (let i = 7; i >= 0; i--) {
      const label = format(new Date(Date.now() - i * 60 * 60 * 1000), "ha");
      map[label] = 0;
    }
    orders.forEach((o) => {
      const label = format(new Date(o.createdAt), "ha");
      if (label in map) map[label] += 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [orders]);

  // CSV download
  function downloadCSV() {
    const headers = [
      "id",
      "customer",
      "type",
      "status",
      "assigned",
      "createdAt",
      "items",
      "total",
      "delivery_name",
      "delivery_phone",
      "delivery_address",
      "delivery_note",
    ];
    const rows = orders.map((o) => {
      const itemsStr = o.items.map((it) => `${it.name} x${it.qty}`).join("; ");
      const total = o.items.reduce((s, it) => s + it.qty * it.price, 0);
      return [
        o.id,
        o.customer,
        o.type,
        o.status,
        o.assigned || "",
        o.createdAt,
        itemsStr,
        total.toFixed(2),
        o.delivery?.name || "",
        o.delivery?.phone || "",
        o.delivery?.address || "",
        o.delivery?.note || "",
      ];
    });
    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify("CSV download started");
  }

  // Print single order
  function printOrder(order) {
    const shop = shopInfo || {};
    const total = order.items.reduce((s, it) => s + it.qty * it.price, 0);
    const lines = order.items
      .map((it) => {
        const lineTotal = it.qty * it.price;
        // const lineTotal = (it.qty * it.price).toFixed(2);
        return `<tr style="font-size:13px">
    <td style="padding:4px 6px;">${escapeHtml(it.name)}</td>
    <td class="right" style="padding:2px 3px;">${it.qty}</td>
    <td class="right" style="padding:2px 3px;">${it.price}</td>
    <td class="right" style="padding:2px 3px;">${lineTotal}</td>
  </tr>`;
      })
      .join("");
    const deliverySection =
      order.type === "Delivery" && order.delivery
        ? `
      <div style="margin-top:8px;font-size:13px;">
        <strong>Delivery to:</strong><br/>
        ${escapeHtml(order.delivery.name || "")}<br/>
        ${escapeHtml(order.delivery.phone || "")}<br/>
        ${escapeHtml(order.delivery.address || "")}<br/>
        ${order.delivery.note ? `<em>Note: ${escapeHtml(order.delivery.note)}</em>` : ""}
      </div>
    `
        : "";

    const subtotal = order.items.reduce((s, it) => s + it.qty * it.price, 0);
    const grandTotal = subtotal; // adjust if you add tax/fees later

    const html = `
<html>
<head>
 
  <meta charset="utf-8" />
  <style>
      @page { size: auto; margin: 0mm; } /* allow printer to choose length */
  html, body {
    margin: 0;
    padding: 0;
    color: #000;
    -webkit-print-color-adjust: exact;
    
    font-size: 12px;
    line-height: 1.1;
    height: auto !important;
  }

    .receipt {
    width: 300px;        /* change to 240px / 380px if your printer needs it */
    max-width: 100%;
    margin: 0 auto;
    padding: 8px 10px;
    box-sizing: border-box;
    display: block;
    height: auto;
    filter: none;
  }

  /* Visual styles */
  .center { text-align: center; }
  .muted { color: #000; opacity: 1; font-size: 11px; }
  .bold { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: fixed; }
  colgroup col:first-child { width: 57%; }
  colgroup col:nth-child(2) { width: 13%; }
  colgroup col:nth-child(3) { width: 15%; }
  colgroup col:nth-child(4) { width: 15%; }
  th, td { padding: 4px 6px; vertical-align: top; word-wrap: break-word; }
  th { font-weight: 700; font-size: 12px; }
  .right { text-align: right; }
  hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }

  /* Printing behaviour: avoid breaking rows across pages */
  table { page-break-inside: auto; }
  tr    { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; } /* keep header on each printed page */
  tfoot { display: table-footer-group; }
      strong{
        font-size: 13px;
      }
  /* Small print-specific tweaks */
  @media print {
    body { margin: 0; }
    .receipt { box-shadow: none; }
  }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      
      ${
        shop.logo
          ? `<img src="${shop.logo}" alt="logo" style="max-width:140px;height:auto;display:block;margin:0 auto 8px;" />`
          : ""
      }
      <div class="bold" style="font-size:20px;margin-bottom:2px; font-weight: 700;">F . H PIZZA BURGER SAUCE</div>
      <div class="bold" style="font-size:14px;margin-bottom:2px;">Order Confirmation</div>
      <div class="bold" style="font-size:13px;margin-bottom:6px;">Payment Receipt</div>
      <div  style="text-align:left; margin-top:4px">
         <div class=" "><strong>Add:</strong> ${escapeHtml(shop.address || "")}</div>
      <div class=" "><strong>Phone:</strong> ${escapeHtml(shop.phone || "")}</div>
      </div>
   
    </div>

    <div class="spacer"></div>

    <div style="font-size:12px;">
      <div><strong>Date:</strong> ${escapeHtml(format(new Date(order.createdAt), "PPpp"))}</div>
    </div>

    <div class="spacer"></div>

    <div style="font-size:12px;">
      <div><strong>Order:</strong> ${escapeHtml(order.id)}</div>
      <div><strong>Order Type:</strong> ${escapeHtml(order.type || "")}</div>
      <div><strong>Payment Type:</strong> ${escapeHtml(order.paymentType || order.payment || "CASH")}</div>
      ${
        order.type === "Delivery" && order.delivery?.address
          ? `<div><strong>Address:</strong> ${escapeHtml(order.delivery.address)}</div>`
          : ""
      }
      ${
        order.delivery
          ? `<div><strong>Customer:</strong> ${escapeHtml(order.delivery.name || order.customer || "")} ${
              order.delivery.phone ? " • " + escapeHtml(order.delivery.phone) : ""
            }</div>`
          : `<div><strong>Customer:</strong> ${escapeHtml(order.customer || "")}</div>`
      }
      <div><strong>Cashier:</strong> ${escapeHtml(shop.name || "")}</div>
    </div>

    <div class="spacer"></div>

    <hr />

    <table>
      <colgroup>
        <col style="width:52%">
        <col style="width:12%">
        <col style="width:18%">
        <col style="width:18%">
      </colgroup>
      <thead>
        <tr>
          <th style="text-align:left">Description</th>
          <th class="right">QTY</th>
          <th class="right">Price</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lines}
      </tbody>
    </table>

    <hr />

    <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:6px;">
      <div class="muted">Subtotal</div>
      <div class="right">${subtotal.toFixed(2)}</div>
    </div>

    <div style="display:flex;justify-content:space-between;font-weight:900;margin-top:6px;">
      <div class="bold">Total (PKR)</div>
      <div class="right bold">${grandTotal.toFixed(2)}</div>
    </div>

    <div class="spacer"></div>

    <div class="center muted" style="font-size:12px;margin-top:6px;">Thank you for visiting!</div>
  </div>
</body>
</html>
`;

    const w = window.open("", "_blank", "width=500,height=700");
    if (!w) {
      notify("Please allow popups to print");
      return;
    }
    w.document.write(html);
    w.document.close();
    // wait a moment then print
    setTimeout(() => {
      w.focus();
      w.print();
      // optionally close after printing
      // w.close();
    }, 500);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Header
          onOpenCreate={() => setShowCreate(true)}
          onOpenMenu={() => setMenuModalOpen(true)}
          onOpenShop={() => setShopModalOpen(true)}
          onDownloadCSV={downloadCSV}
          query={query}
          setQuery={(v) => (setQuery(v), setPage(1))}
        />

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => (setStatusFilter(e.target.value), setPage(1))}
                  className="border rounded p-2 text-sm"
                >
                  <option>All</option>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => (setTypeFilter(e.target.value), setPage(1))}
                  className="border rounded p-2 text-sm"
                >
                  <option>All</option>
                  <option>Dine-in</option>
                  <option>Takeaway</option>
                  <option>Delivery</option>
                </select>
              </div>

              <div className="text-sm text-slate-500">Showing {filtered.length} order(s)</div>
            </div>

            <OrdersTable
              orders={pageItems}
              onView={(o) => setSelectedOrder(o)}
              onUpdate={(id, patch) => {
                setOrders((prev) => {
                  const before = prev.find((o) => o.id === id);
                  const next = prev.map((o) => (o.id === id ? { ...o, ...patch } : o));
                  const after = next.find((o) => o.id === id);
                  if (before && after && before.status !== after.status && after.status === "Delivered") {
                    // record completed order
                    addCompleted(after);
                  }
                  return next;
                });
              }}
              onDelete={(id) => deleteOrder(id)}
              onPrint={(o) => printOrder(o)}
            />

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 rounded border disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <button
                  className="px-3 py-1 rounded border disabled:opacity-40"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <aside className="bg-white rounded-2xl shadow p-4">
            <CompletedOrdersList
              completed={completedOrders}
              onDelete={(id) => removeCompleted(id)}
              onDeleteDay={(dayKey) => removeCompletedDay(dayKey)}
              onClear={() => clearCompleted()}
            />

            <div className="mt-4">
              <h4 className="text-sm font-medium">Quick stats</h4>
              <ul className="mt-2 text-sm text-slate-600 space-y-1">
                <li>Total orders: {orders.length}</li>
                <li>Pending: {orders.filter((o) => o.status === "Pending").length}</li>
                <li>Preparing: {orders.filter((o) => o.status === "Preparing").length}</li>
              </ul>
            </div>

            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Menu ({menu.length})</h4>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMenuModalOpen(true)} className="px-2 py-1 border rounded text-sm">
                    Manage
                  </button>
                </div>
              </div>
              <ul className="mt-2 text-sm text-slate-600 max-h-40 overflow-auto space-y-2">
                {menu.map((m) => (
                  <li key={m.id} className="flex items-center justify-between">
                    <div>{m.name}</div>
                    <div className="text-slate-500">{m.price}</div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t pt-3">
                <button
                  onClick={() => setShopModalOpen(true)}
                  className="w-full px-3 py-2 bg-slate-900 text-white rounded"
                >
                  Edit Shop Info
                </button>
                <button
                  onClick={downloadCSV}
                  className="w-full px-3 py-2 mt-2 border rounded flex items-center justify-center gap-2"
                >
                  <DownloadIcon className="w-5 h-5" /> Download CSV
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* Modals */}
        <AnimatePresence>
          {selectedOrder && (
            <OrderModal
              key={selectedOrder.id}
              order={selectedOrder}
              menu={menu}
              shopInfo={shopInfo}
              onClose={() => setSelectedOrder(null)}
              onSave={(o) => (upsertOrder(o), setSelectedOrder(null))}
              onPrint={(o) => printOrder(o)}
            />
          )}

          {showCreate && (
            <CreateOrderModal
              key="create"
              menu={menu}
              onClose={() => setShowCreate(false)}
              onCreate={(o) => (upsertOrder(o), setShowCreate(false))}
            />
          )}

          {menuModalOpen && (
            <MenuModal
              menu={menu}
              onClose={() => setMenuModalOpen(false)}
              onAdd={addMenuItem}
              onUpdate={updateMenuItem}
              onDelete={deleteMenuItem}
            />
          )}

          {shopModalOpen && (
            <ShopModal
              shopInfo={shopInfo}
              onClose={() => setShopModalOpen(false)}
              onSave={(s) => (setShopInfo(s), setShopModalOpen(false))}
            />
          )}
        </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="fixed right-6 bottom-6 bg-white shadow rounded px-4 py-2"
            >
              <div className="text-sm">{toast}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------- Header ----------
function Header({ onOpenCreate, onOpenMenu, onOpenShop, onDownloadCSV, query, setQuery }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">Restaurant Orders</h1>
        <p className="text-sm text-slate-500">Manage incoming orders, statuses, menu and receipts.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders, customers, items..."
            className="pl-10 pr-3 py-2 border rounded-lg w-80"
          />
        </div>

        <button
          onClick={onOpenCreate}
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg shadow"
        >
          <PlusIcon className="w-5 h-5" />
          New Order
        </button>

        <button onClick={onDownloadCSV} className="inline-flex items-center gap-2 border px-3 py-2 rounded">
          <DownloadIcon className="w-5 h-5" />
          Export CSV
        </button>

        <button className="p-2 rounded-md border" title="Notifications">
          <BellIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ---------- Orders Table ----------
function OrdersTable({ orders, onView, onUpdate, onDelete, onPrint }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b">
            <th className="py-2">Order</th>
            <th className="py-2">Customer</th>
            <th className="py-2">Items</th>
            <th className="py-2">Total</th>
            <th className="py-2">Type</th>
            <th className="py-2">Status</th>
            <th className="py-2">When</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-slate-500">
                No orders to show
              </td>
            </tr>
          )}
          {orders.map((o) => (
            <tr key={o.id} className="border-b hover:bg-slate-50">
              <td className="py-3 font-medium">{o.id}</td>
              <td className="py-3">{o.customer}</td>
              <td className="py-3">{o.items.reduce((s, it) => s + it.qty, 0)}</td>
              <td className="py-3">{o.items.reduce((s, it) => s + it.qty * it.price, 0).toFixed(2)}</td>
              <td className="py-3">{o.type}</td>
              <td className="py-3">
                <StatusBadge status={o.status} />
              </td>
              <td className="py-3 text-sm text-slate-500">{formatDistanceToNow(new Date(o.createdAt))} ago</td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => onView(o)} className="px-2 py-1 rounded border text-xs">
                    View
                  </button>
                  <StatusDropdown order={o} onChange={(s) => onUpdate(o.id, { status: s })} />
                  <button onClick={() => onPrint(o)} className="px-2 py-1 rounded border text-xs" title="Print Receipt">
                    <PrinterIcon className="w-4 h-4 inline" />
                  </button>
                  <button className="px-2 py-1 rounded border text-xs text-red-600" onClick={() => onDelete(o.id)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }) {
  const color =
    status === "Pending"
      ? "bg-yellow-100 text-yellow-800"
      : status === "Preparing"
      ? "bg-indigo-100 text-indigo-800"
      : status === "Ready"
      ? "bg-green-100 text-green-800"
      : status === "Delivered"
      ? "bg-slate-100 text-slate-700"
      : "bg-red-100 text-red-800";
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{status}</span>;
}

function StatusDropdown({ order, onChange }) {
  return (
    <select
      value={order.status}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border rounded px-2 py-1"
    >
      {statuses.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

// ---------- Order Modal ----------
function OrderModal({ order, onClose, onSave, onPrint, menu, shopInfo }) {
  const [draft, setDraft] = useState(order);

  useEffect(() => setDraft(order), [order]);

  const total = draft.items.reduce((s, it) => s + it.qty * it.price, 0);

  const updateItemQty = (idx, qty) =>
    setDraft((d) => ({ ...d, items: d.items.map((it, i) => (i === idx ? { ...it, qty } : it)) }));

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        className="bg-white rounded-2xl shadow-lg w-full max-w-3xl p-6 relative z-10"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Order {draft.id}</h3>
            <p className="text-sm text-slate-500">
              {draft.customer} • {draft.type}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onPrint(draft)} className="px-3 py-2 border rounded">
              Print
            </button>
            <button onClick={onClose} className="p-2 rounded hover:bg-slate-100">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium">Items</h4>
            <ul className="mt-2 space-y-2 text-sm">
              {draft.items.map((it, idx) => (
                <li key={idx} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-slate-500">
                      {it.price} • qty {it.qty}
                    </div>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <input
                      type="number"
                      value={it.qty}
                      min={1}
                      onChange={(e) => updateItemQty(idx, Math.max(1, Number(e.target.value)))}
                      className="w-20 p-1 border rounded text-sm"
                    />
                    <div>{(it.price * it.qty).toFixed(2)}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-sm font-medium">Total: {total.toFixed(2)}</div>
          </div>

          <div>
            <label className="block text-sm font-medium">Status</label>
            <select
              value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
              className="mt-2 p-2 border rounded w-full"
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <label className="block text-sm font-medium mt-4">Assigned</label>
            <input
              value={draft.assigned || ""}
              onChange={(e) => setDraft((d) => ({ ...d, assigned: e.target.value }))}
              className="mt-2 p-2 border rounded w-full"
              placeholder="Table number or driver"
            />

            {draft.type === "Delivery" && (
              <div className="mt-4">
                <h4 className="text-sm font-medium">Delivery details</h4>
                <input
                  value={draft.delivery?.name || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, delivery: { ...(d.delivery || {}), name: e.target.value } }))
                  }
                  placeholder="Recipient name"
                  className="mt-2 p-2 border rounded w-full"
                />
                <input
                  value={draft.delivery?.phone || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, delivery: { ...(d.delivery || {}), phone: e.target.value } }))
                  }
                  placeholder="Phone"
                  className="mt-2 p-2 border rounded w-full"
                />
                <input
                  value={draft.delivery?.address || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, delivery: { ...(d.delivery || {}), address: e.target.value } }))
                  }
                  placeholder="Address"
                  className="mt-2 p-2 border rounded w-full"
                />
                <input
                  value={draft.delivery?.note || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, delivery: { ...(d.delivery || {}), note: e.target.value } }))
                  }
                  placeholder="Note (optional)"
                  className="mt-2 p-2 border rounded w-full"
                />
              </div>
            )}

            <div className="mt-6 flex items-center gap-2">
              <button onClick={() => onSave({ ...draft })} className="px-4 py-2 bg-slate-900 text-white rounded">
                Save
              </button>
              <button onClick={onClose} className="px-3 py-2 border rounded">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------- Create Order Modal ----------
function CreateOrderModal({ onClose, onCreate, menu }) {
  const [customer, setCustomer] = useState("");
  const [type, setType] = useState("Dine-in");
  const [items, setItems] = useState([{ ...menu[0], qty: 1 }]);
  const [delivery, setDelivery] = useState({ name: "", phone: "", address: "", note: "" });

  useEffect(() => {
    // update default items if menu changes
    setItems((s) => (s.length ? s : [{ ...menu[0], qty: 1 }]));
  }, [menu]);

  const addItem = () => setItems((s) => [...s, { ...menu[0], qty: 1 }]);
  const updateItem = (idx, patch) => setItems((s) => s.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => setItems((s) => s.filter((_, i) => i !== idx));

  const submit = () => {
    const order = {
      id: uid(),
      customer: customer || (type === "Delivery" ? delivery.name || "Guest" : "Guest"),
      type,
      items,
      status: "Pending",
      assigned: "Unassigned",
      createdAt: now(),
      delivery: type === "Delivery" ? { ...delivery } : null,
    };
    onCreate(order);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-2xl shadow-lg w-full max-w-2xl p-6 relative z-10"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create new order</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-slate-100">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="p-2 border rounded"
            placeholder="Customer name"
          />
          <select value={type} onChange={(e) => setType(e.target.value)} className="p-2 border rounded">
            <option>Dine-in</option>
            <option>Takeaway</option>
            <option>Delivery</option>
          </select>

          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={it.id}
                onChange={(e) => {
                  const m = menu.find((m) => m.id === e.target.value);
                  updateItem(idx, { id: m.id, name: m.name, price: m.price });
                }}
                className="p-2 border rounded flex-1"
              >
                {menu.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.price}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={it.qty}
                min={1}
                onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value)) })}
                className="w-20 p-2 border rounded"
              />
              <button onClick={() => removeItem(idx)} className="px-2 py-1 border rounded text-red-600">
                Remove
              </button>
            </div>
          ))}

          <button onClick={addItem} className="text-sm text-slate-700">
            + Add item
          </button>

          {type === "Delivery" && (
            <div className="mt-2 border p-3 rounded">
              <h4 className="font-medium">Delivery details</h4>
              <input
                value={delivery.name}
                onChange={(e) => setDelivery((d) => ({ ...d, name: e.target.value }))}
                className="mt-2 p-2 border rounded"
                placeholder="Recipient name (optional)"
              />
              <input
                value={delivery.phone}
                onChange={(e) => setDelivery((d) => ({ ...d, phone: e.target.value }))}
                className="mt-2 p-2 border rounded"
                placeholder="Phone"
              />
              <input
                value={delivery.address}
                onChange={(e) => setDelivery((d) => ({ ...d, address: e.target.value }))}
                className="mt-2 p-2 border rounded"
                placeholder="Address"
              />
              <input
                value={delivery.note}
                onChange={(e) => setDelivery((d) => ({ ...d, note: e.target.value }))}
                className="mt-2 p-2 border rounded"
                placeholder="Note (optional)"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button onClick={submit} className="px-4 py-2 bg-slate-900 text-white rounded">
              Create
            </button>
            <button onClick={onClose} className="px-3 py-2 border rounded">
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------- Menu Modal ----------
function MenuModal({ menu, onClose, onAdd, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setPrice(editing.price);
    } else {
      setName("");
      setPrice(0);
    }
  }, [editing]);

  const startAdd = () => {
    setEditing(null);
    setName("");
    setPrice(0);
  };
  const startEdit = (m) => setEditing(m);
  const submit = () => {
    if (!name) return;
    if (editing) onUpdate(editing.id, { name, price: Number(price) });
    else onAdd({ name, price: Number(price) });
    setEditing(null);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-2xl shadow-lg w-full max-w-2xl p-6 relative z-10"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Manage Menu</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-slate-100">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex gap-4">
          <div className="w-1/2">
            <ul className="space-y-2">
              {menu.map((m) => (
                <li key={m.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-sm text-slate-500">{m.price}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(m)} className="px-2 py-1 border rounded text-sm">
                      <PencilIcon className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => onDelete(m.id)} className="px-2 py-1 border rounded text-sm text-red-600">
                      <TrashIcon className="w-4 h-4 inline" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-1/2">
            <div className="space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Item name"
              />
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                type="number"
                className="w-full p-2 border rounded"
                placeholder="Price"
              />
              <div className="flex gap-2">
                <button onClick={submit} className="px-3 py-2 bg-slate-900 text-white rounded">
                  {editing ? "Save" : "Add"}
                </button>
                <button onClick={startAdd} className="px-3 py-2 border rounded">
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------- Shop Modal ----------
function ShopModal({ shopInfo, onClose, onSave }) {
  const [draft, setDraft] = useState(shopInfo);
  useEffect(() => setDraft(shopInfo), [shopInfo]);
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6 relative z-10"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Shop Information</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-slate-100">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files && e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                setDraft((d) => ({ ...d, logo: reader.result })); // reader.result is dataURL
              };
              reader.readAsDataURL(file);
            }}
          />

          {draft.logo && (
            <div style={{ marginTop: 8 }}>
              <img src={draft.logo} alt="logo" style={{ maxWidth: 140, height: "auto", display: "block" }} />
              <button type="button" onClick={() => setDraft((d) => ({ ...d, logo: null }))} className="text-sm mt-1">
                Remove
              </button>
            </div>
          )}
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="w-full p-2 border rounded"
            placeholder="Shop name"
          />
          <input
            value={draft.address}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            className="w-full p-2 border rounded"
            placeholder="Address"
          />
          <input
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            className="w-full p-2 border rounded"
            placeholder="Phone"
          />
          <input
            value={draft.taxNumber}
            onChange={(e) => setDraft((d) => ({ ...d, taxNumber: e.target.value }))}
            className="w-full p-2 border rounded"
            placeholder="Tax number (optional)"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => onSave(draft)} className="px-3 py-2 bg-slate-900 text-white rounded">
              Save
            </button>
            <button onClick={onClose} className="px-3 py-2 border rounded">
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CompletedOrdersList({ completed, onDelete, onDeleteDay, onClear }) {
  // grouped: [{ day: '2025-09-23', items: [...] }, ...] sorted newest-first
  const grouped = React.useMemo(() => {
    const map = {};
    completed.forEach((o) => {
      const day = format(new Date(o.completedAt), "yyyy-MM-dd");
      if (!map[day]) map[day] = [];
      map[day].push(o);
    });
    const days = Object.keys(map).sort((a, b) => b.localeCompare(a)); // newest first
    return days.map((d) => ({ day: d, items: map[d] }));
  }, [completed]);

  const currency = (n) => Number(n).toFixed(2);

  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Completed ({completed.length})</h4>
        <div className="flex items-center gap-2">
          <button onClick={onClear} className="text-xs text-red-600">
            Clear all
          </button>
        </div>
      </div>

      <div className="mt-2 text-sm text-slate-600 space-y-4 max-h-72 overflow-auto">
        {grouped.length === 0 && <div className="py-2 text-xs text-slate-500">No completed orders</div>}

        {grouped.map(({ day, items }) => {
          // dayTotal: sum of all items totals in that day
          const dayTotal = items.reduce((s, o) => {
            return s + (o.items ? o.items.reduce((ss, it) => ss + it.qty * it.price, 0) : 0);
          }, 0);

          return (
            <div key={day} className="border rounded p-2 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium">{format(new Date(day), "PPP")}</div>
                  <div className="text-xs text-slate-500">{items.length} order(s)</div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="font-semibold">{currency(dayTotal)}</div>
                  <button
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete ${items.length} completed order(s) from ${format(new Date(day), "PPP")}?`
                        )
                      )
                        return;
                      onDeleteDay(day);
                    }}
                    className="px-2 py-1 text-xs border rounded text-red-600"
                    title="Delete all completed orders for this day"
                  >
                    Delete day
                  </button>
                </div>
              </div>

              <ul className="space-y-2">
                {items.map((c) => {
                  const orderTotal = (c.items || []).reduce((s, it) => s + it.qty * it.price, 0);
                  return (
                    <li key={c.id} className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{c.customer || "Guest"}</div>
                        <div className="text-xs text-slate-500">
                          {(c.items || []).map((it) => `${it.name} x${it.qty}`).join(", ")}
                        </div>
                        <div className="text-xs text-slate-400">{format(new Date(c.completedAt), "p")}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">{currency(orderTotal)}</div>
                        <button
                          onClick={() => onDelete(c.id)}
                          className="px-2 py-1 text-xs border rounded text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// // ---------- Helpers ----------
// function createRandomOrder(menu) {
//   const count = Math.ceil(Math.random() * 3);
//   const items = Array.from({ length: count }).map(() => {
//     const item = menu[Math.floor(Math.random() * menu.length)];
//     return { ...item, qty: Math.ceil(Math.random() * 3) };
//   });
//   return {
//     id: uid(),
//     customer: `Guest ${Math.floor(Math.random() * 1000)}`,
//     type: Math.random() > 0.6 ? "Delivery" : Math.random() > 0.5 ? "Takeaway" : "Dine-in",
//     items,
//     status: "Pending",
//     assigned: "Unassigned",
//     createdAt: now(),
//   };
// }

// --- helpers for grouping / deleting by day ---

function escapeHtml(unsafe) {
  if (!unsafe && unsafe !== 0) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
