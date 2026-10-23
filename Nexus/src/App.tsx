import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import {
  ArrowLeft, ArrowRight, MapPin, LocateFixed, HeartHandshake, Package, Users,
  Truck, Building2, CheckCircle2, Plus, Minus, ShieldCheck, Utensils, Navigation, ClipboardCheck, AlertTriangle, RefreshCw, HandHeart
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./App.css";

type Role = "Donor" | "Volunteer / Rider" | "Shelter / Community Kitchen" | "Coordinator";
type Point = { lat: number; lng: number; label: string };
type Item = { name: string; unit: string; qty: number; customName?: string };
type Donation = {
  id: string; items: Item[]; point: Point; createdAt: number; status: string;
  deadline: number; notes: string; prepTime?: string; contact?: string; photo?: string;
};
type Demand = {
  id: string; name: string; items: Item[]; point: Point; people: number;
  status: string; facilities: string[]; contact: string; requiredBy: string; photo?: string;
};
type Delivery = {
  id: string; donationId: string; demandId: string; volunteer: string;
  status: "Accepted" | "Heading to pickup" | "Picked up" | "In transit" | "Delivered" | "Issue reported" | "Cancelled by coordinator";
  updatedAt: number; issue?: string;
};

const roles: { name: Role; desc: string; icon: typeof Package }[] = [
  { name: "Donor", desc: "Share surplus food and essentials", icon: Package },
  { name: "Volunteer / Rider", desc: "Pick up and deliver eligible aid", icon: Truck },
  { name: "Shelter / Community Kitchen", desc: "Register needs and centre status", icon: Building2 },
  { name: "Coordinator", desc: "Coordinate aid, demand and delivery", icon: Users },
];
const catalogue = [
  { name: "Cooked meals", unit: "meals", needs: [] },
  { name: "Bread and bakery", unit: "items", needs: [] },
  { name: "Fresh fruits", unit: "kg", needs: [] },
  { name: "Vegetables", unit: "kg", needs: [] },
  { name: "Milk and dairy", unit: "litres", needs: ["Refrigeration"] },
  { name: "Dry ration kits", unit: "kits", needs: ["Clean water", "Cooking fuel"] },
  { name: "Canned / packaged food", unit: "packs", needs: [] },
  { name: "Drinking water", unit: "litres", needs: [] },
  { name: "Essential hygiene kits", unit: "kits", needs: [] },
  { name: "Short-life medical supplies", unit: "packs", needs: ["Coordinator verification"] },
  { name: "Infant supplies", unit: "packs", needs: ["Coordinator verification"] },
  { name: "Other", unit: "items", needs: [] },
];
const facilitiesList = ["Clean water", "Cooking fuel", "Refrigeration", "Storage"];
const deliveryStages: Delivery["status"][] = ["Accepted", "Heading to pickup", "Picked up", "In transit", "Delivered"];

function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function save<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be disabled */ }
}
function markerIcon(kind: string) {
  const emoji = kind === "Donor" ? "📦" : kind === "Shelter" ? "🏠" : kind === "Volunteer" ? "🛵" : "📍";
  return L.divIcon({ className: "nexus-marker", html: `<span>${emoji}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
}
function PinPicker({ point, onPick }: { point: Point; onPick: (p: Point) => void }) {
  useMapEvents({ click(e) { onPick({ ...point, lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) }); } });
  return <Marker position={[point.lat, point.lng]} icon={markerIcon("Selected")}><Popup>Selected pin<br />{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</Popup></Marker>;
}
function Recenter({ point }: { point: Point }) {
  const map = useMap();
  useEffect(() => { map.setView([point.lat, point.lng], Math.max(map.getZoom(), 13)); }, [point.lat, point.lng, map]);
  return null;
}
const freshItems = (): Item[] => [{ name: "Cooked meals", unit: "meals", qty: 40 }];

function readImage(file: File, setImage: (value: string) => void, setNotice: (value: string) => void) {
  if (!file.type.startsWith("image/")) { setNotice("Please choose an image file."); return; }
  if (file.size > 1_500_000) { setNotice("Please choose an image under 1.5 MB for this demo."); return; }
  const reader = new FileReader();
  reader.onload = () => setImage(String(reader.result || ""));
  reader.onerror = () => setNotice("Could not read this image. Please try another file.");
  reader.readAsDataURL(file);
}

const ITEM_ART: Record<string, string> = { "Cooked meals": "🍛", "Bread and bakery": "🥖", "Fresh fruits": "🍎", "Vegetables": "🥦", "Milk and dairy": "🥛", "Dry ration kits": "🌾", "Canned / packaged food": "🥫", "Drinking water": "💧", "Essential hygiene kits": "🧼", "Short-life medical supplies": "💊", "Infant supplies": "🍼", "Other": "📦" };
const art = (n: string) => <span className="item-art" aria-hidden="true">{ITEM_ART[n] ?? "📦"}</span>;
export default function App() {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>(() => (localStorage.getItem("nexus_session_role") as Role) || "Donor");
  const [place, setPlace] = useState("Pune community location");
  const [address, setAddress] = useState("");
  const [point, setPoint] = useState<Point>({ lat: 18.5204, lng: 73.8567, label: "Pune map pin" });
  const [gpsMessage, setGpsMessage] = useState("");
  const [selected, setSelected] = useState<string[]>(["Cooked meals"]);
  const [items, setItems] = useState<Item[]>(freshItems);
  const [notes, setNotes] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [safeUntil, setSafeUntil] = useState("");
  const [customName, setCustomName] = useState("");
  const [donationPhoto, setDonationPhoto] = useState("");
  const [centrePhoto, setCentrePhoto] = useState("");
  const [contact, setContact] = useState("");
  const [donorSubstep, setDonorSubstep] = useState(0);
  const [centreName, setCentreName] = useState("");
  const [people, setPeople] = useState("50");
  const [centreStatus, setCentreStatus] = useState("Active");
  const [facilities, setFacilities] = useState<string[]>(["Clean water"]);
  const [requiredBy, setRequiredBy] = useState("");
  const [volunteerName, setVolunteerName] = useState("");
  const [issueText, setIssueText] = useState("");
  const [activeIssueId, setActiveIssueId] = useState("");
  const [donations, setDonations] = useState<Donation[]>(() => read("nexus_v2_donations", read("nexus_donations", [])));
  const [demands, setDemands] = useState<Demand[]>(() => read("nexus_v2_demands", read("nexus_demands", [])));
  const [deliveries, setDeliveries] = useState<Delivery[]>(() => read("nexus_v2_deliveries", []));
  const [notice, setNotice] = useState("");
  const [apiReady, setApiReady] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);

  // Load shared state from the Express API first. If the API is not running,
  // continue in local-demo mode without losing the browser's saved records.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/state")
      .then(async response => {
        if (!response.ok) throw new Error("API unavailable");
        return response.json();
      })
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data.donations)) setDonations(data.donations);
        if (Array.isArray(data.demands)) setDemands(data.demands);
        if (Array.isArray(data.deliveries)) setDeliveries(data.deliveries);
        setBackendConnected(true);
        setApiReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setBackendConnected(false);
          setApiReady(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!apiReady) return;
    save("nexus_v2_donations", donations);
    save("nexus_v2_demands", demands);
    save("nexus_v2_deliveries", deliveries);
    if (backendConnected) {
      fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donations, demands, deliveries })
      })
        .then(r => { if (!r.ok) throw new Error("save failed"); setLastSaved(Date.now()); setSaveError(false); })
        .catch(() => setSaveError(true));
    }
  }, [apiReady, backendConnected, donations, demands, deliveries]);

  const mapPoints = useMemo(() => [
    ...donations.map(d => ({ ...d.point, kind: "Donor", title: "Donation", detail: d.items.map(i => `${i.qty} ${i.unit} ${i.customName || i.name}`).join(", "), status: d.status })),
    ...demands.filter(d => d.status === "Active").map(d => ({ ...d.point, kind: "Shelter", title: d.name, detail: `${d.people} people · ${d.items.map(i => i.name).join(", ")}`, status: d.status })),
  ], [donations, demands]);

  const chooseItem = (name: string) => {
    const next = selected.includes(name) ? selected.filter(x => x !== name) : [...selected, name];
    setSelected(next);
    setItems(old => {
      const retained = old.filter(i => next.includes(i.name));
      return [...retained, ...next.filter(n => !old.some(i => i.name === n)).map(n => {
        const c = catalogue.find(x => x.name === n)!; return { name: n, unit: c.unit, qty: 1 };
      })];
    });
  };
  const updateItem = (name: string, patch: Partial<Item>) => setItems(prev => prev.map(i => i.name === name ? { ...i, ...patch } : i));
  const toggleFacility = (f: string) => setFacilities(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const useGPS = () => {
    if (!navigator.geolocation) { setGpsMessage("GPS is not supported by this browser. Choose a map pin or type a landmark."); return; }
    setGpsMessage("Requesting browser location permission…");
    navigator.geolocation.getCurrentPosition(
      p => { setPoint({ lat: p.coords.latitude, lng: p.coords.longitude, label: "Current GPS pin" }); setPlace("Current GPS location"); setGpsMessage("GPS pin selected. You can move it on the map; your typed landmark is not overwritten."); },
      () => setGpsMessage("Location permission denied or unavailable. Click the map or use a landmark instead."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  const saveLandmark = () => {
    if (!address.trim()) { setGpsMessage("Type a landmark first."); return; }
    setPlace(address.trim());
    setGpsMessage("Landmark text saved. Geocoding is not configured; click the map to choose its exact coordinates.");
  };

  const submitDonation = () => {
    if (!items.length || items.some(i => !Number.isFinite(i.qty) || i.qty <= 0)) { setNotice("Choose at least one item and enter quantities greater than zero."); return; }
    if (items.some(i => i.name === "Other" && !customName.trim())) { setNotice("Name your custom item before submitting."); return; }
    const cooked = items.some(i => i.name === "Cooked meals");
    if (cooked && !prepTime) { setNotice("Cooked meals require preparation date and time."); return; }
    if (cooked && !safeUntil) { setNotice("Enter the safe-use deadline for cooked meals."); return; }
    const deadline = safeUntil ? new Date(safeUntil).getTime() : Date.now() + 24 * 3600000;
    if (!Number.isFinite(deadline) || deadline <= Date.now()) { setNotice("The safe-use deadline must be in the future."); return; }
    if (cooked && prepTime && deadline - new Date(prepTime).getTime() > 8 * 3600000) { setNotice("Cooked meals must have a deadline no later than 8 hours after preparation. Set an earlier deadline."); return; }
    const donation: Donation = {
      id: crypto.randomUUID(), items: items.map(i => ({ ...i, customName: i.name === "Other" ? customName.trim() : undefined })),
      point: { ...point, label: place || "Selected map pin" }, createdAt: Date.now(), status: "Available",
      deadline, notes, prepTime: prepTime || undefined, contact, photo: donationPhoto || undefined
    };
    setDonations(prev => [donation, ...prev]);
    setNotice(backendConnected ? "Donation submitted to NEXUS. It is now visible in the shared local backend." : "Donation saved in this browser demo. Start/connect the backend for server persistence.");
    setStep(4);
  };
  const submitDemand = () => {
    if (!centreName.trim()) { setNotice("Enter a centre name."); return; }
    if (!items.length || items.some(i => i.qty <= 0)) { setNotice("Select requested categories and enter quantities greater than zero."); return; }
    const demand: Demand = {
      id: crypto.randomUUID(), name: centreName.trim(), items: items.map(i => ({ ...i })), point: { ...point, label: place || centreName },
      people: Number(people) || 0, status: centreStatus, facilities, contact, requiredBy, photo: centrePhoto || undefined
    };
    setDemands(prev => [demand, ...prev]);
    setNotice(backendConnected ? "Centre demand saved to NEXUS backend." : "Centre demand saved in this browser demo.");
    setStep(4);
  };
  const availableDonations = donations.filter(d => d.status === "Available" && d.deadline > Date.now());
  const activeDemands = demands.filter(d => d.status === "Active");
  const matchFor = (donation: Donation) => activeDemands.filter(d => d.items.some(di => donation.items.some(si => si.name === di.name)));
  const acceptTask = (d: Donation, shelterId: string) => {
    if (deliveries.some(x => x.donationId === d.id && !["Delivered", "Issue reported"].includes(x.status))) {
      setNotice("This donation already has an active delivery."); return;
    }
    const shelter = demands.find(x => x.id === shelterId);
    if (!shelter || shelter.status !== "Active") { setNotice("That centre is not active. Choose an active centre."); return; }
    const matchingItems = d.items.filter(si => shelter.items.some(di => di.name === si.name));
    if (!matchingItems.length) { setNotice("No compatible category matches this centre's demand."); return; }
    const missing = matchingItems.some(si => catalogue.find(c => c.name === si.name)?.needs.some(n => !shelter.facilities.includes(n)));
    if (missing) { setNotice("The centre may lack a required handling facility. Coordinator review is required before assignment."); return; }
    const id = crypto.randomUUID();
    setDeliveries(prev => [{ id, donationId: d.id, demandId: shelter.id, volunteer: volunteerName.trim() || "Demo volunteer", status: "Accepted", updatedAt: Date.now() }, ...prev]);
    setDonations(prev => prev.map(x => x.id === d.id ? { ...x, status: "Reserved for delivery" } : x));
    setNotice(`Delivery assigned to ${shelter.name}. The donation is reserved; quantity splitting is not enabled in this prototype.`);
  };
  const updateDelivery = (id: string, status: Delivery["status"], issue?: string) => {
    setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status, updatedAt: Date.now(), issue } : d));
    const current = deliveries.find(d => d.id === id);
    if (current && status === "Delivered") setDonations(prev => prev.map(d => d.id === current.donationId ? { ...d, status: "Delivered" } : d));
    if (current && status === "Issue reported") setNotice("Issue logged. Coordinator must review and explicitly decide the next action; no automatic redirect was made.");
  };

  const back = () => { setNotice(""); setStep(s => Math.max(0, s - 1)); };
  const resetWorkflow = () => { setSelected([]); setItems([]); setNotes(""); setPrepTime(""); setSafeUntil(""); setCustomName(""); setContact(""); setDonationPhoto(""); setCentrePhoto(""); setDonorSubstep(0); setNotice(""); setStep(1); };
  const title = step === 0 ? "Surplus should reach someone." : step === 1 ? "How would you like to help?" : step === 2 ? "Choose the right place." : step === 3 ? role === "Donor" ? "Share what you have." : role === "Shelter / Community Kitchen" ? "Tell us what’s needed." : role === "Volunteer / Rider" ? "Move aid safely." : "Coordinate the network." : "Your NEXUS overview.";

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setStep(0)} aria-label="NEXUS home"><span className="brand-mark"><img src="/nexus-logo.png" alt="" width="40" height="40"/></span><span>NEXUS<small>Food • Care • Connection</small></span></button>
      <div className="top-actions"><span className={`demo-pill ${backendConnected ? "backend-on" : ""}`}><span className="connection-dot"/>{backendConnected ? (saveError ? "SAVE FAILED · RETRYING" : lastSaved ? `SAVED TO SERVER · ${new Date(lastSaved).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "BACKEND CONNECTED") : "DEMO MODE"}</span><button className="ghost-button" onClick={() => { setStep(1); setNotice(""); }}>Switch role</button></div>
    </header>
    <main className="main-wrap">
      <section className="intro-row"><div><p className="eyebrow">COMMUNITY AID, BETTER CONNECTED</p><h1>{title}</h1><p className="intro-copy">{step === 0 ? "Connecting surplus to those who need it — with time-aware, location-aware community logistics." : step === 1 ? "Choose a role and NEXUS will tailor the workflow." : step === 2 ? "GPS, typed landmarks and selected map pins remain explicit choices." : step === 3 ? "Make each donation, need and delivery status clear and accountable." : backendConnected ? "Records are saved by the local backend and can be shared by browser sessions using this running server." : "Demo records are saved in this browser. Start the backend for shared server-side persistence."}</p></div><div className="hero-stamp"><ShieldCheck size={24}/><span>Safety-first<br/><b>community logistics</b></span></div></section>
      <nav className="stepper" aria-label="Progress">{["Welcome", "Role", "Location", "Workflow", "Overview"].map((label, i) => <div key={label} className={`step-item ${step === i ? "active" : ""} ${step > i ? "complete" : ""}`}><span>{step > i ? <CheckCircle2 size={16}/> : i + 1}</span><small>{label}</small></div>)}</nav>

      {step === 0 && <section className="welcome-grid">
        <div className="welcome-card"><div className="welcome-icon"><HeartHandshake size={34}/></div><p className="eyebrow">WELCOME TO NEXUS</p><h2>Good food and essential aid deserve a clear path.</h2><p>Connect donors, shelters, volunteers and coordinators. Match eligible supplies to active needs and make every handoff visible.</p><ul className="benefit-list"><li><CheckCircle2/> Time-aware donation records</li><li><CheckCircle2/> Map pins for pickup and receiving centres</li><li><CheckCircle2/> Delivery milestones and issue reporting</li></ul><button className="primary wide" onClick={() => setStep(1)}>Continue <ArrowRight size={18}/></button><p className="fine-print"><ShieldCheck size={14}/> Demo access only — authentication is not configured.</p></div>
        <div className="welcome-side"><div className="impact-stat"><span className="stat-icon"><Utensils/></span><div><strong>Food with a deadline</strong><p>Record preparation time and safe-use deadline.</p></div></div><div className="impact-stat"><span className="stat-icon"><MapPin/></span><div><strong>Locations with consent</strong><p>GPS is requested only when you press the button.</p></div></div><div className="impact-stat"><span className="stat-icon"><Truck/></span><div><strong>Visible handoffs</strong><p>Track accepted, pickup, transit and delivery states.</p></div></div><div className="quote-card">“The last mile matters most when time is running out.”</div></div>
      </section>}

      {step === 1 && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">STEP 1 OF 4</p><h2>Select your role</h2><p>Choose the workflow you want to open.</p></div></div><div className="role-grid">{roles.map(r => { const Icon = r.icon; return <button key={r.name} className={`role-card ${role === r.name ? "selected" : ""}`} onClick={() => setRole(r.name)}><span className="role-icon"><Icon size={25}/></span><strong>{r.name}</strong><span>{r.desc}</span><span className="radio-dot">{role === r.name ? <CheckCircle2 size={18}/> : null}</span></button>; })}</div><div className="panel-footer"><button className="secondary" onClick={back}><ArrowLeft size={17}/> Back</button><button className="primary" onClick={() => { setNotice(""); setStep(2); }}>Continue <ArrowRight size={17}/></button></div></section>}

      {step === 2 && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">STEP 2 OF 4</p><h2>Set a pickup or centre location</h2><p>Type a landmark, request GPS, or click the map. Landmark text is not silently geocoded.</p></div></div><div className="location-layout"><div className="location-form">
        <label>Place or landmark<input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Sunrise Bakery, hostel mess, shelter"/></label><button className="secondary full" onClick={saveLandmark}><MapPin size={17}/> Save landmark text</button>
        <button className="secondary full" onClick={useGPS}><LocateFixed size={17}/> Use my current GPS</button>{gpsMessage && <p className="inline-notice">{gpsMessage}</p>}
        <div className="selected-place"><span><MapPin size={19}/></span><div><b>Selected pin</b><small>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</small><small>{place}</small></div></div>
        <label>
  Contact number (optional)
  <input
    value={contact}
    onChange={e => setContact(e.target.value)}
    placeholder="For coordination"
    inputMode="tel"
  />
</label>
</div>        <div className="map-wrap"><div className="map-topline"><span><span className="live-dot"/> INTERACTIVE MAP</span><button className="icon-button" onClick={useGPS} title="Request GPS"><Navigation size={18}/></button></div><MapContainer center={[point.lat, point.lng]} zoom={13} scrollWheelZoom className="map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Recenter point={point}/><PinPicker point={point} onPick={p => { setPoint(p); setPlace(address.trim() || "Manually selected map pin"); }}/>{mapPoints.map((p, i) => <Marker key={`${p.kind}-${i}`} position={[p.lat, p.lng]} icon={markerIcon(p.kind)}><Popup><b>{p.title}</b><br/>{p.detail}<br/>Status: {p.status}</Popup></Marker>)}</MapContainer><p className="map-caption">Click the map to set the exact pin. OpenStreetMap attribution is retained.</p></div></div>
        <div className="panel-footer"><button className="secondary" onClick={back}><ArrowLeft size={17}/> Back</button><button className="primary" onClick={() => { setNotice(""); setStep(3); }}>Continue <ArrowRight size={17}/></button></div></section>}

      {step === 3 && role === "Donor" && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">DONOR WORKFLOW · {donorSubstep + 1} OF 4</p><h2>{["Select items", "Quantity & pickup", "Expiry & handling", "Review & submit"][donorSubstep]}</h2><p>{["Choose all eligible categories you can provide.", "Confirm amounts, units and contact details.", "Set the deadline based on actual storage and handling.", "Review what will be recorded before submitting."][donorSubstep]}</p></div><span className="step-tag"><Package size={16}/> Donation</span></div>
        <div className="mini-stepper">{["Items", "Quantity", "Safety", "Review"].map((s, i) => <button key={s} className={donorSubstep === i ? "mini-step active" : "mini-step"} onClick={() => setDonorSubstep(i)}>{i + 1}. {s}</button>)}</div>
        {donorSubstep === 0 && <><div className="catalogue-grid">{catalogue.map(c => <button key={c.name} className={`catalogue-card ${selected.includes(c.name) ? "selected" : ""}`} onClick={() => chooseItem(c.name)}><span className="check-square">{selected.includes(c.name) ? <CheckCircle2 size={18}/> : <Plus size={18}/>}</span>{art(c.name)}<strong>{c.name}</strong>{c.needs.length > 0 && <em>Needs: {c.needs.join(", ")}</em>}</button>)}</div>{selected.includes("Other") && <div className="custom-item-box"><label>What is the other item? *<input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. sealed baby wipes, blankets, utensils" maxLength={80}/></label><small>Give it a clear name so the receiving centre knows exactly what is offered.</small></div>}</>}
        {donorSubstep === 1 && <><div className="quantity-section"><h3>Quantity and units</h3>{items.map(item => <div className="quantity-row" key={item.name}><b>{item.customName || item.name}</b><input type="number" min="1" value={item.qty} onChange={e => updateItem(item.name, { qty: Number(e.target.value) })} aria-label={`${item.name} quantity`}/><select value={item.unit} onChange={e => updateItem(item.name, { unit: e.target.value })}>{["meals","items","kg","litres","kits","packs","boxes","crates"].map(u => <option key={u}>{u}</option>)}</select><button className="icon-button danger" onClick={() => chooseItem(item.name)} aria-label={`Remove ${item.name}`}><Minus size={17}/></button></div>)}</div><label className="spaced-label">Pickup instructions / storage notes<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Packaging, access instructions, storage conditions"/></label><div className="photo-upload"><div><b>Photo of the donation <span className="optional-tag">OPTIONAL</span></b><small>Helps the receiver identify the right package at pickup.</small></div><label className="upload-button"><Plus size={16}/> {donationPhoto ? "Change photo" : "Add photo"}<input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) readImage(f, setDonationPhoto, setNotice); }} /></label>{donationPhoto && <div className="photo-preview-wrap"><img className="photo-preview" src={donationPhoto} alt="Donation preview"/><button className="text-button" onClick={() => setDonationPhoto("")}>Remove</button></div>}</div></>}
        {donorSubstep === 2 && <><div className="safety-box"><ShieldCheck size={21}/><div><b>Conservative safety checks</b><p>For cooked meals, enter preparation time and a safe-use deadline no more than 8 hours later. This prototype is not a food-safety certification; earlier local guidance always takes precedence.</p></div></div><div className="two-col"><label>Prepared at {selected.includes("Cooked meals") && <span className="required">*</span>}<input type="datetime-local" value={prepTime} onChange={e => setPrepTime(e.target.value)}/></label><label>Safe-use deadline {selected.includes("Cooked meals") && <span className="required">*</span>}<input type="datetime-local" value={safeUntil} onChange={e => setSafeUntil(e.target.value)}/></label></div><div className="dependency-list">{items.map(item => { const c = catalogue.find(x => x.name === item.name); return c?.needs.length ? <p key={item.name}><AlertTriangle size={15}/><b>{item.name}:</b> {c.needs.join(", ")} may be required.</p> : null; })}</div></>}
        {donorSubstep === 3 && <div className="review-card"><h3><ClipboardCheck size={18}/> Donation review</h3><p><b>Location:</b> {place} ({point.lat.toFixed(4)}, {point.lng.toFixed(4)})</p><p><b>Items:</b> {items.map(i => `${i.qty} ${i.unit} ${i.customName || i.name}`).join(" · ") || "No items selected"}</p><p><b>Prepared:</b> {prepTime || "Not specified"}</p><p><b>Safe-use deadline:</b> {safeUntil || "Not specified"}</p><p><b>Notes:</b> {notes || "None"}</p><p><b>Contact:</b> {contact || "Not provided"}</p><p><b>Photo:</b> {donationPhoto ? "Attached (optional)" : "No photo attached"}</p>{donationPhoto && <img className="review-photo" src={donationPhoto} alt="Donation review"/>}</div>}
        {notice && <p className="inline-notice">{notice}</p>}
        <div className="panel-footer"><button className="secondary" onClick={() => donorSubstep > 0 ? setDonorSubstep(s => s - 1) : back()}><ArrowLeft size={17}/> Back</button>{donorSubstep < 3 ? <button className="primary" onClick={() => { setNotice(""); if (donorSubstep === 0 && !items.length) { setNotice("Select at least one item."); return; } setDonorSubstep(s => s + 1); }}>Next step <ArrowRight size={17}/></button> : <button className="primary" onClick={submitDonation}>Submit donation <CheckCircle2 size={17}/></button>}</div>
      </section>}

      {step === 3 && role === "Shelter / Community Kitchen" && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">RECEIVING CENTRE</p><h2>Register centre demand</h2><p>Set requested categories, quantities, facilities and whether your centre can receive deliveries.</p></div><span className="step-tag"><Building2 size={16}/> Centre needs</span></div>
        <div className="two-col"><label>Centre name *<input value={centreName} onChange={e => setCentreName(e.target.value)} placeholder="e.g. Shanti Community Kitchen"/></label><label>People to serve<input type="number" min="1" value={people} onChange={e => setPeople(e.target.value)}/></label></div>
        <h3>Requested categories</h3><div className="catalogue-grid compact">{catalogue.map(c => <button key={c.name} className={`catalogue-card ${selected.includes(c.name) ? "selected" : ""}`} onClick={() => chooseItem(c.name)}><span className="check-square">{selected.includes(c.name) ? <CheckCircle2 size={18}/> : <Plus size={18}/>}</span>{art(c.name)}<strong>{c.name}</strong><small>Unit: {c.unit}</small></button>)}</div>{selected.includes("Other") && <div className="custom-item-box"><label>What other item does the centre need? *<input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. blankets, baby wipes, plates" maxLength={80}/></label><small>Make the requested item specific so donors can understand the need.</small></div>}
        <div className="quantity-section"><h3>Required quantities</h3>{items.map(item => <div className="quantity-row" key={item.name}><b>{item.name}</b><input type="number" min="1" value={item.qty} onChange={e => updateItem(item.name, { qty: Number(e.target.value) })}/><select value={item.unit} onChange={e => updateItem(item.name, { unit: e.target.value })}>{["meals","items","kg","litres","kits","packs","boxes"].map(u => <option key={u}>{u}</option>)}</select><button className="icon-button danger" onClick={() => chooseItem(item.name)}><Minus size={17}/></button></div>)}</div>
        <div className="two-col"><label>Centre status<select value={centreStatus} onChange={e => setCentreStatus(e.target.value)}><option>Active</option><option>Temporarily closed</option><option>Full</option></select></label><label>Required by (optional)<input type="datetime-local" value={requiredBy} onChange={e => setRequiredBy(e.target.value)}/></label></div>
        <h3>Facilities available</h3><div className="facility-row">{facilitiesList.map(f => <label className="check-label" key={f}><input type="checkbox" checked={facilities.includes(f)} onChange={() => toggleFacility(f)}/>{f}</label>)}</div>
        <div className="photo-upload"><div><b>Centre / receiving point photo <span className="optional-tag">OPTIONAL</span></b><small>Helps volunteers recognise the correct entrance or handoff point.</small></div><label className="upload-button"><Plus size={16}/> {centrePhoto ? "Change photo" : "Add photo"}<input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) readImage(f, setCentrePhoto, setNotice); }}/></label>{centrePhoto && <div className="photo-preview-wrap"><img className="photo-preview" src={centrePhoto} alt="Centre preview"/><button className="text-button" onClick={() => setCentrePhoto("")}>Remove</button></div>}</div><label className="spaced-label">Centre contact (optional)<input value={contact} onChange={e => setContact(e.target.value)} placeholder="Phone or contact details"/></label>
        {notice && <p className="inline-notice">{notice}</p>}<div className="panel-footer"><button className="secondary" onClick={back}><ArrowLeft size={17}/> Back</button><button className="primary" onClick={submitDemand}>Save centre demand <ArrowRight size={17}/></button></div>
      </section>}

      {step === 3 && role === "Volunteer / Rider" && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">VOLUNTEER WORKFLOW</p><h2>Eligible delivery tasks</h2><p>Choose an active centre with matching categories. No fake route estimates are shown.</p></div><span className="step-tag"><Truck size={16}/> Rider</span></div>
        <label className="spaced-label">Volunteer display name<input value={volunteerName} onChange={e => setVolunteerName(e.target.value)} placeholder="Name (demo only)"/></label>
        {availableDonations.length ? availableDonations.map(d => <div className="task-card task-column" key={d.id}><div>{d.photo && <img className="task-photo" src={d.photo} alt="Donation items"/>}<b>{d.items.map(i => `${i.qty} ${i.unit} ${i.customName || i.name}`).join(", ")}</b><p><MapPin size={14}/> {d.point.label}</p><small>Safe-use deadline: {new Date(d.deadline).toLocaleString()}</small><div className="match-pills">{matchFor(d).map(s => <span key={s.id}>{s.name}</span>)}</div></div><div className="task-actions">{matchFor(d).length ? matchFor(d).map(s => <button className="primary" key={s.id} onClick={() => acceptTask(d, s.id)}>Accept for {s.name}</button>) : <span className="status">No active matching centre</span>}</div></div>) : <div className="empty-state"><Truck size={32}/><b>No available tasks</b><p>Eligible donations created in this browser will appear here.</p></div>}
        <h3>My delivery progress</h3>{deliveries.filter(d => d.volunteer === (volunteerName.trim() || "Demo volunteer")).length ? deliveries.filter(d => d.volunteer === (volunteerName.trim() || "Demo volunteer")).map(d => <DeliveryCard key={d.id} delivery={d} donation={donations.find(x => x.id === d.donationId)} demand={demands.find(x => x.id === d.demandId)} onAdvance={updateDelivery} issueText={issueText} setIssueText={setIssueText} activeIssueId={activeIssueId} setActiveIssueId={setActiveIssueId}/>) : <p className="hint">Accepted tasks and delivery milestones will appear here.</p>}
        {notice && <p className="inline-notice">{notice}</p>}<div className="panel-footer"><button className="secondary" onClick={back}><ArrowLeft size={17}/> Back</button><button className="primary" onClick={() => setStep(4)}>View overview <ArrowRight size={17}/></button></div>
      </section>}

      {step === 3 && role === "Coordinator" && <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">COORDINATION DESK</p><h2>Monitor and manage the network</h2><p>Review matches, expiry, centre status and delivery issues.</p></div><span className="step-tag"><Users size={16}/> Coordinator</span></div>
        <div className="stats-grid"><div><Package/><strong>{donations.length}</strong><small>Donations</small></div><div><Building2/><strong>{demands.length}</strong><small>Centres</small></div><div><Truck/><strong>{deliveries.filter(d => !["Delivered", "Issue reported"].includes(d.status)).length}</strong><small>Active deliveries</small></div></div>
        <h3>Centre status</h3>{demands.length ? demands.map(d => <div className="task-card" key={d.id}>{d.photo && <img className="task-photo centre-thumb" src={d.photo} alt="Centre location"/>}<div><b>{d.name}</b><p>{d.items.map(i => `${i.qty} ${i.unit} ${i.customName || i.name}`).join(", ")}</p><small>{d.people} people · {d.point.label} {d.requiredBy ? `· needed by ${new Date(d.requiredBy).toLocaleString()}` : ""}</small></div><select value={d.status} onChange={e => setDemands(prev => prev.map(x => x.id === d.id ? { ...x, status: e.target.value } : x))}><option>Active</option><option>Temporarily closed</option><option>Full</option></select></div>) : <div className="empty-state"><Building2 size={30}/><b>No centres registered</b><p>Switch to the shelter role to register centre demand.</p></div>}
        <h3>Donations and expiry</h3>{donations.length ? donations.map(d => { const expired = d.deadline <= Date.now(); return <div className="task-card" key={d.id}>{d.photo && <img className="task-photo" src={d.photo} alt="Donation"/>}<div><b>{d.items.map(i => `${i.qty} ${i.unit} ${i.customName || i.name}`).join(", ")}</b><p>{d.point.label}</p><small>Deadline: {new Date(d.deadline).toLocaleString()}</small></div><div className="task-actions"><span className={`status ${!expired && d.status === "Available" ? "green" : ""}`}>{expired && d.status === "Available" ? "Expired — review" : d.status}</span>{d.status === "Available" && <button className="secondary" onClick={() => setDonations(prev => prev.map(x => x.id === d.id ? { ...x, status: "Withdrawn by coordinator" } : x))}>Withdraw</button>}</div></div>; }) : <p className="hint">No donations yet.</p>}
        <h3>Delivery exceptions</h3>{deliveries.filter(d => d.status === "Issue reported").length ? deliveries.filter(d => d.status === "Issue reported").map(d => <div className="task-card" key={d.id}><div><b>Issue reported</b><p>{d.issue || "No detail provided"}</p><small>Coordinator must explicitly decide whether to cancel or reassign.</small></div><div className="task-actions"><button className="secondary" onClick={() => { setDeliveries(prev => prev.map(x => x.id === d.id ? { ...x, status: "Accepted", issue: undefined, updatedAt: Date.now() } : x)); setNotice("Delivery returned to Accepted for manual recovery. Confirm centre availability first."); }}>Reopen for review</button><button className="primary" onClick={() => { setDeliveries(prev => prev.map(x => x.id === d.id ? { ...x, status: "Cancelled by coordinator", updatedAt: Date.now() } as Delivery : x)); setDonations(prev => prev.map(x => x.id === d.donationId ? { ...x, status: x.deadline > Date.now() ? "Available" : "Expired" } : x)); }}>Cancel & release</button></div></div>) : <p className="hint">No delivery exceptions reported.</p>}
        <h3>Delivery tracking</h3>{deliveries.length ? deliveries.map(d => <DeliveryCard key={d.id} delivery={d} donation={donations.find(x => x.id === d.donationId)} demand={demands.find(x => x.id === d.demandId)} onAdvance={updateDelivery} issueText={issueText} setIssueText={setIssueText} activeIssueId={activeIssueId} setActiveIssueId={setActiveIssueId}/>) : <div className="empty-state"><Truck size={30}/><b>No deliveries assigned yet</b><p>Accept a matching task in the volunteer workflow.</p></div>}
        {notice && <p className="inline-notice">{notice}</p>}<div className="panel-footer"><button className="secondary" onClick={back}><ArrowLeft size={17}/> Back</button><button className="primary" onClick={() => setStep(4)}>View overview <ArrowRight size={17}/></button></div>
      </section>}

      {step === 4 && <section className="panel overview-panel"><div className="success-head"><span><CheckCircle2 size={27}/></span><div><p className="eyebrow">NEXUS LOCAL DEMO</p><h2>Overview and live map</h2><p>{backendConnected ? "Connected to your local NEXUS API · server persistence enabled" : "Browser demo mode · start the API to enable server persistence"}</p></div></div>
        <div className="stats-grid"><div><Package/><strong>{donations.length}</strong><small>Total donations</small></div><div><Building2/><strong>{demands.filter(d => d.status === "Active").length}</strong><small>Active centres</small></div><div><HandHeart/><strong>{deliveries.filter(d => d.status === "Delivered").length}</strong><small>Successfully reached</small></div></div>
        <div className="impact-dashboard"><div className="impact-dashboard-head"><div><p className="eyebrow">NETWORK PULSE</p><h3>Every handoff moves help forward.</h3></div><span className="pulse-chip"><i/> {backendConnected ? "API connected" : "Local demo"}</span></div><div className="pulse-grid"><div><span>Available</span><b>{donations.filter(d => d.status === "Available" && d.deadline > Date.now()).length}</b><small>ready to match</small></div><div><span>In motion</span><b>{deliveries.filter(d => !["Delivered", "Issue reported", "Cancelled by coordinator"].includes(d.status)).length}</b><small>active deliveries</small></div><div><span>Reached</span><b>{deliveries.filter(d => d.status === "Delivered").length}</b><small>marked delivered</small></div><div><span>Needs attention</span><b>{deliveries.filter(d => d.status === "Issue reported").length + donations.filter(d => d.deadline <= Date.now() && d.status === "Available").length}</b><small>issues or expired</small></div></div><div className="progress-label"><span>Delivery completion</span><b>{deliveries.length ? Math.round(deliveries.filter(d => d.status === "Delivered").length / deliveries.length * 100) : 0}%</b></div><div className="progress-track"><span style={{width: `${deliveries.length ? deliveries.filter(d => d.status === "Delivered").length / deliveries.length * 100 : 0}%`}}/></div></div>
        <div className="overview-map"><MapContainer center={[point.lat, point.lng]} zoom={12} scrollWheelZoom className="map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{mapPoints.map((p, i) => <Marker key={`${p.kind}-${i}`} position={[p.lat,p.lng]} icon={markerIcon(p.kind)}><Popup><b>{p.title}</b><br/>{p.detail}<br/>Status: {p.status}</Popup></Marker>)}<Marker position={[point.lat,point.lng]} icon={markerIcon("Selected")}><Popup>Selected place: {place}</Popup></Marker></MapContainer></div>
        <div className="overview-actions"><button className="secondary" onClick={resetWorkflow}><RefreshCw size={16}/> Start another workflow</button><button className="primary" onClick={() => { setStep(1); setNotice(""); }}>Switch role <ArrowRight size={16}/></button></div>
        <h3>Recent activity</h3>{donations.slice(0,5).map(d => <div className="activity-item" key={d.id}><span className="activity-icon"><Package size={17}/></span><div><b>Donation · {d.items.map(i => i.customName || i.name).join(", ")}</b><small>{d.point.label} · {d.status} · deadline {new Date(d.deadline).toLocaleString()}</small></div></div>)}{demands.slice(0,5).map(d => <div className="activity-item" key={d.id}><span className="activity-icon"><Building2 size={17}/></span><div><b>Centre · {d.name}</b><small>{d.point.label} · {d.status}</small></div></div>)}{deliveries.slice(0,5).map(d => <div className="activity-item" key={d.id}><span className="activity-icon"><Truck size={17}/></span><div><b>Delivery · {d.status}</b><small>{demands.find(x => x.id === d.demandId)?.name || "Centre unavailable"} · updated {new Date(d.updatedAt).toLocaleString()}</small></div></div>)}
      </section>}
      <footer className="site-footer"><span>© NEXUS · Social impact logistics prototype</span><span><ShieldCheck size={14}/> {backendConnected ? "Express backend connected · local server" : "Browser demo fallback · backend not connected"}</span></footer>
    </main>
  </div>;
}

function DeliveryCard({
  delivery, donation, demand, onAdvance, issueText, setIssueText, activeIssueId, setActiveIssueId
}: {
  delivery: Delivery; donation?: Donation; demand?: Demand;
  onAdvance: (id: string, status: Delivery["status"], issue?: string) => void;
  issueText: string; setIssueText: (v: string) => void;
  activeIssueId: string; setActiveIssueId: (v: string) => void;
}) {
  const idx = deliveryStages.indexOf(delivery.status);
  const next = deliveryStages[idx + 1];
  return <div className="delivery-card"><div className="delivery-head"><div><b>{demand?.name || "Centre unavailable"}</b><p>{donation?.items.map(i => `${i.qty} ${i.unit} ${i.customName || i.name}`).join(", ") || "Donation unavailable"}</p></div><span className={`status ${delivery.status === "Delivered" ? "green" : ""}`}>{delivery.status === "Delivered" ? "✓ Reached destination" : delivery.status}</span></div>
    <div className="delivery-track">{deliveryStages.map((s, i) => <span key={s} className={i <= idx ? "stage done" : "stage"}>{i < idx ? "✓" : i + 1}<small>{s}</small></span>)}</div>
    {delivery.status === "Issue reported" && <p className="inline-notice">Issue: {delivery.issue || "Details not provided"}. Coordinator review required.</p>}
    <div className="task-actions">{next && delivery.status !== "Issue reported" && <button className="primary" onClick={() => onAdvance(delivery.id, next)}>{next === "Delivered" ? "Mark delivered" : `Update: ${next}`}</button>}{!["Delivered", "Issue reported"].includes(delivery.status) && <button className="secondary" onClick={() => setActiveIssueId(activeIssueId === delivery.id ? "" : delivery.id)}><AlertTriangle size={15}/> Report issue</button>}</div>
    {activeIssueId === delivery.id && <div className="issue-form"><textarea value={issueText} onChange={e => setIssueText(e.target.value)} placeholder="Describe the issue (e.g. centre full, access blocked)"/><button className="secondary" onClick={() => { onAdvance(delivery.id, "Issue reported", issueText.trim() || "Issue details not provided"); setIssueText(""); setActiveIssueId(""); }}>Submit issue</button></div>}
    <small className="updated-time">Last updated: {new Date(delivery.updatedAt).toLocaleString()}</small>
  </div>;
}
