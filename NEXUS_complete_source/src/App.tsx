import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { ArrowLeft, ArrowRight, MapPin, LocateFixed, HeartHandshake, Package, Users, Truck, Building2, CheckCircle2, Plus, Minus, ShieldCheck, Utensils, Droplets, Clock3, LogIn, Home, Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./App.css";

type Role = "Donor" | "Volunteer / Rider" | "Shelter / Community Kitchen" | "Coordinator";
type Point = { lat: number; lng: number; label: string };
type Item = { name: string; unit: string; qty: number; customName?: string };
type Donation = { id: string; items: Item[]; point: Point; createdAt: number; status: string; deadline: number; notes: string };
type Demand = { id: string; name: string; items: Item[]; point: Point; people: number; status: string; facilities: string[] };

const roles: { name: Role; desc: string; icon: typeof Package }[] = [
  { name: "Donor", desc: "Share surplus food and essentials", icon: Package },
  { name: "Volunteer / Rider", desc: "Pick up and deliver eligible aid", icon: Truck },
  { name: "Shelter / Community Kitchen", desc: "Register needs and centre status", icon: Building2 },
  { name: "Coordinator", desc: "Coordinate donations, demand and delivery", icon: Users },
];
const catalogue = [
  { name: "Cooked meals", unit: "meals", safeHours: 8, needs: [] },
  { name: "Bread and bakery", unit: "items", safeHours: 8, needs: [] },
  { name: "Fresh fruits", unit: "kg", safeHours: 24, needs: [] },
  { name: "Vegetables", unit: "kg", safeHours: 24, needs: [] },
  { name: "Milk and dairy", unit: "litres", safeHours: 4, needs: ["Refrigeration"] },
  { name: "Dry ration kits", unit: "kits", safeHours: 72, needs: ["Clean water", "Cooking fuel"] },
  { name: "Canned / packaged food", unit: "packs", safeHours: 168, needs: [] },
  { name: "Drinking water", unit: "litres", safeHours: 168, needs: [] },
  { name: "Essential hygiene kits", unit: "kits", safeHours: 720, needs: [] },
  { name: "Short-life medical supplies", unit: "packs", safeHours: 24, needs: ["Coordinator verification"] },
  { name: "Infant supplies", unit: "packs", safeHours: 72, needs: ["Coordinator verification"] },
  { name: "Other", unit: "items", safeHours: 24, needs: [] },
];
const icon = (name: string) => L.divIcon({ className: "nexus-marker", html: `<span>${name === "Donor" ? "📦" : name === "Shelter" ? "🏠" : name === "Volunteer" ? "🛵" : "📍"}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });

function PinPicker({ point, onPick }: { point: Point; onPick: (p: Point) => void }) {
  useMapEvents({ click(e) { onPick({ ...point, lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) }); } });
  return <Marker position={[point.lat, point.lng]} icon={icon("Selected")}><Popup>Selected location<br />{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</Popup></Marker>;
}
function Recenter({ point }: { point: Point }) {
  const map = useMap();
  useEffect(() => { map.setView([point.lat, point.lng], Math.max(map.getZoom(), 14)); }, [point.lat, point.lng, map]);
  return null;
}
function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function save<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); }

export default function App() {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>("Donor");
  const [demoMode, setDemoMode] = useState(true);
  const [place, setPlace] = useState("Community location");
  const [address, setAddress] = useState("");
  const [point, setPoint] = useState<Point>({ lat: 18.5204, lng: 73.8567, label: "Selected map pin" });
  const [gpsPoint, setGpsPoint] = useState<Point | null>(null);
  const [gpsMessage, setGpsMessage] = useState("");
  const [selected, setSelected] = useState<string[]>(["Cooked meals"]);
  const [items, setItems] = useState<Item[]>([{ name: "Cooked meals", unit: "meals", qty: 40 }]);
  const [notes, setNotes] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [deadline, setDeadline] = useState("8");
  const [centreName, setCentreName] = useState("");
  const [people, setPeople] = useState("50");
  const [centreStatus, setCentreStatus] = useState("Active");
  const [facilities, setFacilities] = useState<string[]>(["Clean water"]);
  const [donations, setDonations] = useState<Donation[]>(() => read("nexus_donations", []));
  const [demands, setDemands] = useState<Demand[]>(() => read("nexus_demands", []));
  const [notice, setNotice] = useState("");
  const [customName, setCustomName] = useState("");

  useEffect(() => { save("nexus_donations", donations); }, [donations]);
  useEffect(() => { save("nexus_demands", demands); }, [demands]);

  const mapPoints = useMemo(() => [
    ...donations.map(d => ({ ...d.point, role: "Donor", detail: d.items.map(i => `${i.qty} ${i.unit} ${i.customName || i.name}`).join(", "), status: d.status })),
    ...demands.filter(d => d.status === "Active").map(d => ({ ...d.point, role: "Shelter", detail: `${d.name} · ${d.people} people · ${d.items.map(i => i.name).join(", ")}`, status: d.status })),
  ], [donations, demands]);

  const chooseItem = (name: string) => {
    setSelected(prev => {
      const next = prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name];
      setItems(old => {
        const retained = old.filter(i => next.includes(i.name));
        return [...retained, ...next.filter(n => !old.some(i => i.name === n)).map(n => {
          const c = catalogue.find(x => x.name === n)!;
          return { name: n, unit: c.unit, qty: 1 };
        })];
      });
      return next;
    });
  };
  const updateItem = (name: string, patch: Partial<Item>) => setItems(prev => prev.map(i => i.name === name ? { ...i, ...patch } : i));
  const useGPS = () => {
    if (!navigator.geolocation) { setGpsMessage("This browser does not support location access. Choose a map pin or type a landmark."); return; }
    setGpsMessage("Requesting location permission…");
    navigator.geolocation.getCurrentPosition(
      p => { const next = { lat: p.coords.latitude, lng: p.coords.longitude, label: "My current GPS location" }; setGpsPoint(next); setPoint(next); setGpsMessage("Current location captured. You can still move the map pin to a different pickup or centre."); },
      () => setGpsMessage("Location permission was denied or unavailable. You can still click the map or enter a landmark."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  const searchLandmark = () => {
    if (!address.trim()) { setGpsMessage("Enter a place or landmark first."); return; }
    setPlace(address.trim());
    setGpsMessage("Landmark saved as text only. No geocoding provider is configured, so please click the map to confirm its exact pin.");
  };
  const submitDonation = () => {
    if (!items.length || items.some(i => i.qty <= 0)) { setNotice("Choose at least one item and enter a quantity greater than zero."); return; }
    const cooked = items.some(i => i.name === "Cooked meals");
    const hrs = Number(deadline);
    if (cooked && (!prepTime || hrs > 8 || hrs <= 0)) { setNotice("For cooked meals, enter preparation time and an eligibility window of 8 hours or less."); return; }
    const newDonation: Donation = { id: crypto.randomUUID(), items: items.map(i => ({ ...i, customName: i.name === "Other" ? customName : undefined })), point: { ...point, label: place || address || "Selected pin" }, createdAt: Date.now(), status: "Available", deadline: Date.now() + hrs * 3600000, notes };
    setDonations(prev => [newDonation, ...prev]);
    setNotice("Donation saved on this browser. It is not yet shared across devices.");
    setStep(4);
  };
  const submitDemand = () => {
    if (!centreName.trim() || !items.length) { setNotice("Add a centre name and select at least one requested category."); return; }
    const demand: Demand = { id: crypto.randomUUID(), name: centreName.trim(), items: items.map(i => ({ ...i })), point: { ...point, label: place || address || centreName }, people: Number(people) || 0, status: centreStatus, facilities };
    setDemands(prev => [demand, ...prev]);
    setNotice("Centre demand saved on this browser. It is not yet shared across devices.");
    setStep(4);
  };
  const toggleFacility = (f: string) => setFacilities(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const stepLabels = ["Welcome", "Role", "Location", "Your workflow", "Overview"];
  const next = () => { setNotice(""); setStep(s => Math.min(4, s + 1)); };
  const back = () => { setNotice(""); setStep(s => Math.max(0, s - 1)); };

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => setStep(0)} aria-label="NEXUS home"><span className="brand-mark"><HeartHandshake size={22} /></span><span>NEXUS<small>Food • Care • Connection</small></span></button><div className="top-actions"><span className="demo-pill">DEMO MODE</span><button className="ghost-button" onClick={() => { setStep(1); setNotice(""); }}>Switch role</button></div></header>
    <main className="main-wrap">
      <section className="intro-row"><div><p className="eyebrow">COMMUNITY AID, BETTER CONNECTED</p><h1>{step === 0 ? "Surplus should reach someone." : step === 1 ? "How would you like to help?" : step === 2 ? "Choose the right place." : step === 3 ? role === "Donor" ? "Share what you have." : role === "Shelter / Community Kitchen" ? "Tell us what’s needed." : role === "Volunteer / Rider" ? "Help move aid safely." : "Coordinate the network." : "Your NEXUS overview."}</h1><p className="intro-copy">{step === 0 ? "Connecting surplus to those who need it — with time-aware, location-aware community logistics." : step === 1 ? "Choose your role. NEXUS will tailor the next steps to what you do." : step === 2 ? "Your current GPS position and the place you are registering are separate choices." : step === 3 ? "Structured choices reduce confusion and help coordinators match aid responsibly." : "Prototype records are saved in this browser for this demo."}</p></div><div className="hero-stamp"><ShieldCheck size={24}/><span>Safety-first<br/><b>community logistics</b></span></div></section>
      <nav className="stepper" aria-label="Progress">{stepLabels.map((label, i) => <div key={label} className={`step-item ${step === i ? "active" : ""} ${step > i ? "complete" : ""}`}><span>{step > i ? <CheckCircle2 size={16}/> : i + 1}</span><small>{label}</small></div>)}</nav>

      {step === 0 && <section className="welcome-grid">
        <div className="welcome-card"><div className="welcome-icon"><HeartHandshake size={34}/></div><p className="eyebrow">WELCOME TO NEXUS</p><h2>Good food and essential aid deserve a clear path.</h2><p>Connect donors, local shelters, volunteers and coordinators in one place. Track real needs, choose a pickup point, and keep time-sensitive aid visible.</p><ul className="benefit-list"><li><CheckCircle2/> Structured donations and centre needs</li><li><CheckCircle2/> Map pins for pickup and receiving locations</li><li><CheckCircle2/> Time-aware eligibility and transparent status</li></ul><button className="primary wide" onClick={next}>Continue <ArrowRight size={18}/></button><p className="fine-print"><LogIn size={14}/> Demo access only — real sign-in is not configured yet.</p></div>
        <div className="welcome-side"><div className="impact-stat"><span className="stat-icon"><Utensils/></span><div><strong>Food with a deadline</strong><p>Make expiry and handling visible before dispatch.</p></div></div><div className="impact-stat"><span className="stat-icon"><MapPin/></span><div><strong>Local, not lost</strong><p>Connect places with map pins and landmark details.</p></div></div><div className="impact-stat"><span className="stat-icon"><Users/></span><div><strong>People over paperwork</strong><p>Make needs and availability easier to coordinate.</p></div></div><div className="quote-card">“The last mile matters most when time is running out.”</div></div>
      </section>}

      {step === 1 && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">STEP 1 OF 4</p><h2>Select your role</h2><p>Pick one role for this demo session.</p></div></div><div className="role-grid">{roles.map(r => { const Icon = r.icon; return <button key={r.name} className={`role-card ${role === r.name ? "selected" : ""}`} onClick={() => setRole(r.name)}><span className="role-icon"><Icon size={25}/></span><strong>{r.name}</strong><span>{r.desc}</span><span className="radio-dot">{role === r.name ? <CheckCircle2 size={18}/> : null}</span></button>; })}</div><div className="panel-footer"><button className="secondary" onClick={back}><ArrowLeft size={17}/> Back</button><button className="primary" onClick={next}>Continue <ArrowRight size={17}/></button></div></section>}

      {step === 2 && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">STEP 2 OF 4</p><h2>Set a place on the map</h2><p>For example, your donor pickup point can be a bakery even when you are elsewhere.</p></div></div><div className="location-layout"><div className="location-form">
        <label>Place or landmark name<input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Sunrise Bakery, hostel mess, shelter"/></label><button className="secondary full" onClick={searchLandmark}><MapPin size={17}/> Save landmark name</button><p className="hint">Landmark search is not connected to a geocoding service in this build. Saving a name does not pretend it has been geocoded.</p>
        <button className="secondary full" onClick={useGPS}><LocateFixed size={17}/> Use my current GPS location</button>{gpsMessage && <p className="inline-notice">{gpsMessage}</p>}
        <div className="selected-place"><span><MapPin size={19}/></span><div><b>Selected map pin</b><small>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</small><small>{place || address || "Click on the map to choose a place"}</small></div></div>
        <label>Pickup / centre contact (optional)<input placeholder="Phone number for coordination" inputMode="tel"/></label>
      </div><div className="map-wrap"><div className="map-topline"><span><span className="live-dot"/> INTERACTIVE MAP</span><button className="icon-button" onClick={() => gpsPoint ? setPoint(gpsPoint) : useGPS()} title="Recenter to GPS"><Navigation size={18}/></button></div><MapContainer center={[point.lat, point.lng]} zoom={13} scrollWheelZoom className="map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Recenter point={point}/><PinPicker point={point} onPick={p => { setPoint(p); setPlace(address.trim() || "Manually selected map pin"); }}/>{mapPoints.map((p, i) => <Marker key={`${p.role}-${i}`} position={[p.lat,p.lng]} icon={icon(p.role)}><Popup><b>{p.role}</b><br/>{p.label}<br/>{p.detail}<br/>Status: {p.status}</Popup></Marker>)}</MapContainer><p className="map-caption">Click anywhere on the map to set the location. GPS and the chosen pin are independent after capture.</p></div></div><div className="panel-footer"><button className="secondary" onClick={back}><ArrowLeft size={17}/> Back</button><button className="primary" onClick={next}>Continue <ArrowRight size={17}/></button></div></section>}

      {step === 3 && role === "Donor" && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">DONOR WORKFLOW</p><h2>Choose donation items</h2><p>Select multiple categories. Add quantities for each item you have.</p></div><span className="step-tag"><Package size={16}/> 1 · Items</span></div><div className="catalogue-grid">{catalogue.map(c => <button key={c.name} className={`catalogue-card ${selected.includes(c.name) ? "selected" : ""}`} onClick={() => chooseItem(c.name)}><span className="check-square">{selected.includes(c.name) ? <CheckCircle2 size={18}/> : <Plus size={18}/>}</span><strong>{c.name}</strong><small>Typical handling window: {c.safeHours >= 24 ? `${Math.round(c.safeHours/24)} day(s)` : `${c.safeHours} hour(s)`}</small>{c.needs.length > 0 && <em>Needs: {c.needs.join(", ")}</em>}</button>)}</div>
        {selected.length > 0 && <div className="quantity-section"><h3>Quantity and units</h3>{items.map(item => <div className="quantity-row" key={item.name}><div><b>{item.name}</b>{item.name === "Other" && <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Name the custom item"/>}</div><input type="number" min="1" value={item.qty} onChange={e => updateItem(item.name,{qty:Number(e.target.value)})} aria-label={`${item.name} quantity`}/><select value={item.unit} onChange={e => updateItem(item.name,{unit:e.target.value})} aria-label={`${item.name} unit`}>{["meals","items","kg","litres","kits","packs","boxes","crates"].map(u => <option key={u}>{u}</option>)}</select><button className="icon-button danger" onClick={() => chooseItem(item.name)} aria-label={`Remove ${item.name}`}><Minus size={17}/></button></div>)}</div>}
        <div className="safety-box"><ShieldCheck size={21}/><div><b>Safety and eligibility</b><p>Cooked meals require preparation time and a declared eligibility window of 8 hours or less. This is a prototype rule, not a food-safety certification. Earlier safe-use deadlines and local food-safety guidance take precedence.</p></div></div>
        <div className="two-col"><label>Preparation date and time {selected.includes("Cooked meals") && <span className="required">*</span>}<input type="datetime-local" value={prepTime} onChange={e => setPrepTime(e.target.value)}/></label><label>Eligibility window (hours)<select value={deadline} onChange={e => setDeadline(e.target.value)}>{["1","2","3","4","5","6","7","8","12","24","48","72"].map(h => <option key={h} value={h}>{h} hours</option>)}</select></label></div>
        <label>Handling / pickup notes<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Storage conditions, packaging, pickup instructions (optional)"/></label>
        {notice && <p className="inline-notice">{notice}</p>}<div className="panel-footer"><button className="secondary" onClick={back}><ArrowLeft size={17}/> Back</button><button className="primary" onClick={submitDonation}>Save donation <ArrowRight size={17}/></button></div></section>}

      {step === 3 && role === "Shelter / Community Kitchen" && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">RECEIVING CENTRE</p><h2>Register centre demand</h2><p>Tell the network what is needed and whether your centre can receive aid now.</p></div><span className="step-tag"><Building2 size={16}/> Centre needs</span></div><div className="two-col"><label>Centre / shelter name *<input value={centreName} onChange={e => setCentreName(e.target.value)} placeholder="e.g. Shanti Community Kitchen"/></label><label>Centre type<select><option>Shelter</option><option>Community kitchen</option><option>NGO</option><option>Relief camp</option><option>Other</option></select></label></div><label>Number of people to serve<input type="number" min="1" value={people} onChange={e => setPeople(e.target.value)}/></label><h3>What does the centre need?</h3><div className="catalogue-grid compact">{catalogue.map(c => <button key={c.name} className={`catalogue-card ${selected.includes(c.name) ? "selected" : ""}`} onClick={() => chooseItem(c.name)}><span className="check-square">{selected.includes(c.name) ? <CheckCircle2 size={18}/> : <Plus size={18}/>}</span><strong>{c.name}</strong><small>Unit: {c.unit}</small></button>)}</div><div className="quantity-section"><h3>Required quantities</h3>{items.map(item => <div className="quantity-row" key={item.name}><b>{item.name}</b><input type="number" min="1" value={item.qty} onChange={e => updateItem(item.name,{qty:Number(e.target.value)})}/><select value={item.unit} onChange={e => updateItem(item.name,{unit:e.target.value})}>{["meals","items","kg","litres","kits","packs","boxes"].map(u => <option key={u}>{u}</option>)}</select></div>)}</div><div className="two-col"><label>Centre status<select value={centreStatus} onChange={e => setCentreStatus(e.target.value)}><option>Active</option><option>Temporarily closed</option><option>Full</option></select></label><label>Required by (optional)<input type="datetime-local"/></label></div><h3>Facilities available</h3><div className="facility-row">{["Clean water","Cooking fuel","Refrigeration","Storage"].map(f => <label className="check-label" key={f}><input type="checkbox" checked={facilities.includes(f)} onChange={() => toggleFacility(f)}/>{f}</label>)}</div>{notice && <p className="inline-notice">{notice}</p>}<div className="panel-footer"><button className="secondary" onClick={back}><ArrowLeft size={17}/> Back</button><button className="primary" onClick={submitDemand}>Save centre demand <ArrowRight size={17}/></button></div></section>}

      {step === 3 && role === "Volunteer / Rider" && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">VOLUNTEER WORKFLOW</p><h2>Available aid tasks</h2><p>Tasks are based on records stored in this browser. Cross-device tasks need a shared backend.</p></div><span className="step-tag"><Truck size={16}/> Rider</span></div>{donations.filter(d => d.status === "Available").length ? donations.filter(d => d.status === "Available").map(d => <div className="task-card" key={d.id}><div><b>{d.items.map(i => `${i.qty} ${i.unit} ${i.customName || i.name}`).join(", ")}</b><p><MapPin size={14}/> {d.point.label}</p><small>Eligibility deadline: {new Date(d.deadline).toLocaleString()}</small></div><button className="primary" onClick={() => { setDonations(prev => prev.map(x => x.id === d.id ? {...x,status:"Claimed — demo"} : x)); setNotice("Task claimed in this browser demo."); }}>Accept task</button></div>) : <div className="empty-state"><Truck size={32}/><b>No available tasks yet</b><p>When a donor creates an eligible donation on this browser, it will appear here.</p></div>}{notice && <p className="inline-notice">{notice}</p>}<div className="panel-footer"><button className="secondary" onClick={back}><ArrowLeft size={17}/> Back</button><button className="primary" onClick={next}>View overview <ArrowRight size={17}/></button></div></section>}

      {step === 3 && role === "Coordinator" && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">COORDINATION DESK</p><h2>Monitor the local network</h2><p>Review local prototype records and manage centre availability.</p></div><span className="step-tag"><Users size={16}/> Coordinator</span></div><div className="stats-grid"><div><Package/><strong>{donations.length}</strong><small>Donations</small></div><div><Building2/><strong>{demands.length}</strong><small>Centres</small></div><div><Clock3/><strong>{donations.filter(d => d.status === "Available" && d.deadline > Date.now()).length}</strong><small>Available batches</small></div></div><h3>Centre status</h3>{demands.length ? demands.map(d => <div className="task-card" key={d.id}><div><b>{d.name}</b><p>{d.items.map(i => `${i.qty} ${i.unit} ${i.name}`).join(", ")}</p><small>{d.people} people · {d.status} · {d.point.label}</small></div><select value={d.status} onChange={e => setDemands(prev => prev.map(x => x.id === d.id ? {...x,status:e.target.value} : x))}><option>Active</option><option>Temporarily closed</option><option>Full</option></select></div>) : <div className="empty-state"><Building2 size={30}/><b>No centres registered yet</b><p>Register a shelter to see its demand here.</p></div>}<h3>Donations</h3>{donations.length ? donations.map(d => <div className="task-card" key={d.id}><div><b>{d.items.map(i => `${i.qty} ${i.unit} ${i.customName || i.name}`).join(", ")}</b><p>{d.point.label}</p><small>{new Date(d.createdAt).toLocaleString()} · deadline {new Date(d.deadline).toLocaleString()}</small></div><span className={`status ${d.status.startsWith("Available") ? "green" : ""}`}>{d.status}</span></div>) : <p className="hint">No donations yet.</p>}<div className="panel-footer"><button className="secondary" onClick={back}><ArrowLeft size={17}/> Back</button><button className="primary" onClick={next}>View overview <ArrowRight size={17}/></button></div></section>}

      {step === 4 && <section className="panel overview-panel"><div className="success-head"><span><CheckCircle2 size={27}/></span><div><p className="eyebrow">NEXUS LOCAL DEMO</p><h2>Overview and live map</h2><p>Your records are saved in this browser only.</p></div></div><div className="stats-grid"><div><Package/><strong>{donations.length}</strong><small>Donations</small></div><div><Building2/><strong>{demands.length}</strong><small>Centres</small></div><div><Droplets/><strong>{demands.filter(d => d.status === "Active").length}</strong><small>Active centres</small></div></div><div className="overview-map"><MapContainer center={[point.lat, point.lng]} zoom={12} scrollWheelZoom className="map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{mapPoints.map((p, i) => <Marker key={`${p.role}-${i}`} position={[p.lat,p.lng]} icon={icon(p.role)}><Popup><b>{p.role}</b><br/>{p.label}<br/>{p.detail}<br/>Status: {p.status}</Popup></Marker>)}<Marker position={[point.lat,point.lng]} icon={icon("Selected")}><Popup>Current selected place: {place}</Popup></Marker></MapContainer></div><h3>Recent activity</h3>{donations.length === 0 && demands.length === 0 ? <div className="empty-state"><Package size={30}/><b>Your network starts here</b><p>Register a donation or centre need to see it on the map.</p></div> : <div className="activity-list">{donations.slice(0,5).map(d => <div className="activity-item" key={d.id}><span className="activity-icon"><Package size={17}/></span><div><b>Donation · {d.items.map(i => i.customName || i.name).join(", ")}</b><small>{d.point.label} · {d.status}</small></div></div>)}{demands.slice(0,5).map(d => <div className="activity-item" key={d.id}><span className="activity-icon"><Building2 size={17}/></span><div><b>Centre · {d.name}</b><small>{d.point.label} · {d.status}</small></div></div>)}</div>}<div className="panel-footer wrap-footer"><button className="secondary" onClick={() => { setStep(1); setNotice(""); }}><ArrowLeft size={17}/> Start another workflow</button><button className="primary" onClick={() => { setStep(0); setNotice(""); }}>Back to welcome <Home size={17}/></button></div></section>}

      <footer className="site-footer"><span>© NEXUS · Social impact logistics prototype</span><span><ShieldCheck size={14}/> Demo data stays in this browser</span></footer>
    </main>
  </div>;
}
