import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import "../css/Profile.css";


interface MeetingTime {
    day: string;
    start: string;
    end: string;
}

interface Obligation {
    name: string;
    bucketName: string;
    isClass: boolean;
    hasMeetings: boolean;
    meetingTimes: MeetingTime[];
    priority: number;
    maxStretch: number;
}

interface Bucket {
    name: string;
    priority: number;
    obligations: Obligation[];
}

interface Profile {
    username: string;
    email: string;
    password: string;
    buckets: Bucket[];
}


function normalizeProfile(raw: any): Profile {
    const username = raw?.username ?? "";
    const email = raw?.email ?? "";
    const password = raw?.password ?? "";

    const rawBuckets = Array.isArray(raw?.buckets) ? raw.buckets : [];

    let buckets: Bucket[];

    if (rawBuckets.length === 0) {
        buckets = [{ name: "School Work", priority: 100, obligations: [] }];
    } else {
        buckets = rawBuckets.map((b: any) => ({
            name: String(b?.name ?? "Unnamed"),
            priority: Number.isFinite(b?.priority) ? b.priority : 0,
            obligations: Array.isArray(b?.obligations)
                ? b.obligations.map((o: any) => ({
                    name: String(o?.name ?? "Unnamed obligation"),
                    bucketName: String(o?.bucketName ?? String(b?.name ?? "Unnamed")),
                    isClass: !!o?.isClass,
                    hasMeetings: !!o?.hasMeetings,
                    meetingTimes: Array.isArray(o?.meetingTimes)
                        ? o.meetingTimes.map((m: any) => ({
                            day: String(m?.day ?? "Monday"),
                            start: String(m?.start ?? "09:00"),
                            end: String(m?.end ?? "10:00"),
                        }))
                        : [],
                    priority: Number.isFinite(o?.priority) ? o.priority : 0,
                    maxStretch: Number.isFinite(o?.maxStretch) ? o.maxStretch : 2,
                }))
                : [],
        }));
    }

    return { username, email, password, buckets };
}


function rebalance<T extends { priority: number }>(
    items: T[],
    changedIndex: number,
    newValue: number
): T[] {
    const len = items.length;
    if (len === 0) return items;


    if (len === 1) {
        return [{ ...items[0], priority: 100 }];
    }


    const target = Math.max(0, Math.min(100, Math.round(newValue)));


    const othersTotalBefore = items.reduce((s, it, idx) => {
        return idx === changedIndex ? s : s + it.priority;
    }, 0);

    const remaining = Math.max(0, 100 - target);


    const anyOthers = othersTotalBefore > 0;

    let result = items.map((it, idx) => {
        if (idx === changedIndex) return { ...it, priority: target };
        if (!anyOthers) {
            // Even distribution among others
            const per = Math.floor(remaining / (len - 1));
            return { ...it, priority: per };
        } else {
            // Scale proportionally
            const scaled = Math.round((it.priority / othersTotalBefore) * remaining);
            return { ...it, priority: scaled };
        }
    });

    // Fix rounding error so sum = 100 exactly
    const sum = result.reduce((s, it) => s + it.priority, 0);
    const diff = 100 - sum;
    if (diff !== 0) {
        // Nudge the last item that isn't the changed one (or fallback to changed)
        let idxToFix = result.findIndex((_, idx) => idx !== changedIndex);
        if (idxToFix === -1) idxToFix = changedIndex;
        const fixed = Math.max(0, Math.min(100, result[idxToFix].priority + diff));
        result[idxToFix] = { ...result[idxToFix], priority: fixed };
    }

    return result;
}

// Rebalance the obligations of a bucket
function rebalanceBucketObligations(
    bucket: Bucket,
    changedIndex: number,
    newValue: number
): Bucket {
    if (bucket.obligations.length === 0) return bucket;
    const reb = rebalance(bucket.obligations, changedIndex, newValue);
    return { ...bucket, obligations: reb };
}

/* =======================
   Component
======================= */

export default function ProfilePage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [buckets, setBuckets] = useState<Bucket[]>([
        { name: "School Work", priority: 100, obligations: [] },
    ]);

    // Add-bucket UI
    const [newBucketName, setNewBucketName] = useState("");

    // Add-obligation UI
    const [newObligation, setNewObligation] = useState<Obligation>({
        name: "",
        bucketName: "School Work",
        isClass: false,
        hasMeetings: false,
        meetingTimes: [],
        priority: 0,
        maxStretch: 2,
    });

    // Add-meeting UI snippet
    const [newMeeting, setNewMeeting] = useState<MeetingTime>({
        day: "Monday",
        start: "09:00",
        end: "10:00",
    });

    // Load and normalize profile from localStorage once
    useEffect(() => {
        const stored = localStorage.getItem("activeProfile");
        if (stored) {
            const parsed = normalizeProfile(JSON.parse(stored));
            // Also normalize top-level buckets' total; ensure we have something valid
            const hasAny = parsed.buckets.length > 0;
            const normalized =
                hasAny && parsed.buckets.reduce((s, b) => s + b.priority, 0) > 0
                    ? parsed
                    : {
                        ...parsed,
                        buckets: [{ name: "School Work", priority: 100, obligations: [] }],
                    };
            setProfile(normalized);
            setBuckets(normalized.buckets);
            // Initialize default bucket name for new obligations if available
            if (normalized.buckets[0]) {
                setNewObligation((prev) => ({
                    ...prev,
                    bucketName: normalized.buckets[0].name,
                }));
            }
        }
    }, []);

    /* =======================
       Buckets
    ======================= */

    // Auto-balancing bucket priority slider
    const handleBucketPriorityChange = (bucketIndex: number, value: number) => {
        setBuckets((prev) => rebalance(prev, bucketIndex, value));
    };

    const totalBuckets = useMemo(
        () => buckets.reduce((s, b) => s + b.priority, 0),
        [buckets]
    );

    const addBucket = () => {
        const name = newBucketName.trim();
        if (!name) return;
        if (buckets.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
            alert("A bucket with that name already exists.");
            return;
        }
        // Add with a default 10% and auto-balance
        const next = [...buckets, { name, priority: 10, obligations: [] }];
        const newIndex = next.length - 1;
        const rebalanced = rebalance(next, newIndex, 10);
        setBuckets(rebalanced);
        setNewBucketName("");
    };

    /* =======================
       Obligations
    ======================= */

    const addMeetingTime = () => {
        // Quick guard if start >= end (string compare is fine for HH:mm)
        if (newMeeting.start >= newMeeting.end) {
            alert("End time must be after start time.");
            return;
        }
        setNewObligation((prev) => ({
            ...prev,
            meetingTimes: [...prev.meetingTimes, newMeeting],
        }));
        setNewMeeting({ day: "Monday", start: "09:00", end: "10:00" });
    };

    const addObligation = () => {
        const name = newObligation.name.trim();
        if (!name) {
            alert("Obligation name is required.");
            return;
        }
        if (!newObligation.bucketName) {
            alert("Please choose a bucket for this obligation.");
            return;
        }

        // If it's a class, ensure hasMeetings and at least one meeting time
        if (newObligation.isClass) {
            if (newObligation.meetingTimes.length === 0) {
                alert("Classes must include at least one meeting time.");
                return;
            }
        } else if (newObligation.hasMeetings) {
            if (newObligation.meetingTimes.length === 0) {
                alert("This obligation has meetings—please add at least one.");
                return;
            }
        }

        setBuckets((prev) => {
            const idx = prev.findIndex((b) => b.name === newObligation.bucketName);
            if (idx === -1) return prev;

            const targetBucket = prev[idx];

            // Insert with a small default, then auto-balance
            const inserted = [...targetBucket.obligations, newObligation];
            const newObIndex = inserted.length - 1;
            const rebalancedObligs = rebalance(inserted, newObIndex, 10);

            const updatedBucket: Bucket = {
                ...targetBucket,
                obligations: rebalancedObligs,
            };
            const next = [...prev];
            next[idx] = updatedBucket;
            return next;
        });

        // Reset new obligation form (keep bucket for convenience)
        setNewObligation((prev) => ({
            name: "",
            bucketName: prev.bucketName,
            isClass: false,
            hasMeetings: false,
            meetingTimes: [],
            priority: 0,
            maxStretch: 2,
        }));
    };

    const handleObligationPriorityChange = (
        bucketIndex: number,
        obligationIndex: number,
        value: number
    ) => {
        setBuckets((prev) => {
            const copy = [...prev];
            const bucket = copy[bucketIndex];
            const rebalanced = rebalanceBucketObligations(bucket, obligationIndex, value);
            copy[bucketIndex] = rebalanced;
            return copy;
        });
    };

    /* =======================
       Save
    ======================= */

    const saveProfile = () => {
        if (!profile) return;

        // Ensure each bucket has obligations that total 100 (if any exist)
        const bad = buckets.find(
            (b) => b.obligations.length > 0 &&
                b.obligations.reduce((s, o) => s + o.priority, 0) !== 100
        );
        if (bad) {
            alert(
                `Obligations in bucket "${bad.name}" must total 100%. Adjust sliders first.`
            );
            return;
        }

        if (totalBuckets !== 100) {
            alert("Bucket priorities must total exactly 100%.");
            return;
        }

        const updated: Profile = { ...profile, buckets };
        localStorage.setItem("activeProfile", JSON.stringify(updated));

        // (Optional) keep "user" in sync so new logins carry your data forward
        const userRaw = localStorage.getItem("user");
        if (userRaw) {
            const user = JSON.parse(userRaw);
            localStorage.setItem(
                "user",
                JSON.stringify({ ...user, buckets: updated.buckets })
            );
        }

        setProfile(updated);
        alert("✅ Profile saved!");
    };

    if (!profile) {
        return (
            <div className="profile-page">
                <Navbar />
                <div className="profile-container">
                    <h1>No profile found.</h1>
                    <p>Go back to Home and create or log into a profile.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <Navbar />
            <div className="profile-container">
                <h1>Welcome, {profile.username}</h1>
                <p>Set up your buckets and obligations for schedule generation.</p>

                {/* ========== Buckets ========== */}
                <section>
                    <h2>Buckets (must total 100%)</h2>

                    {buckets.map((b, i) => (
                        <div key={b.name + i} style={{ marginBottom: "0.8rem" }}>
                            <strong>{b.name}</strong> – {b.priority}%
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={b.priority}
                                onChange={(e) =>
                                    handleBucketPriorityChange(i, parseInt(e.target.value, 10))
                                }
                            />
                        </div>
                    ))}

                    <p>
                        Total: <strong>{totalBuckets}%</strong> (must equal 100)
                    </p>

                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <input
                            type="text"
                            placeholder="New bucket name"
                            value={newBucketName}
                            onChange={(e) => setNewBucketName(e.target.value)}
                        />
                        <button onClick={addBucket}>Add Bucket</button>
                    </div>
                </section>

                {/* ========== New Obligation ========== */}
                <section>
                    <h2>Add Obligation</h2>

                    <input
                        type="text"
                        placeholder="Obligation name"
                        value={newObligation.name}
                        onChange={(e) =>
                            setNewObligation({ ...newObligation, name: e.target.value })
                        }
                    />

                    <select
                        value={newObligation.bucketName}
                        onChange={(e) =>
                            setNewObligation({ ...newObligation, bucketName: e.target.value })
                        }
                    >
                        {buckets.map((b) => (
                            <option key={b.name} value={b.name}>
                                {b.name}
                            </option>
                        ))}
                    </select>

                    <div style={{ display: "flex", gap: "1rem", margin: "0.5rem 0" }}>
                        <label>
                            <input
                                type="checkbox"
                                checked={newObligation.isClass}
                                onChange={(e) =>
                                    setNewObligation({
                                        ...newObligation,
                                        isClass: e.target.checked,
                                        hasMeetings: e.target.checked ? true : newObligation.hasMeetings,
                                    })
                                }
                            />
                            {" "}Is Class?
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={newObligation.hasMeetings}
                                onChange={(e) =>
                                    setNewObligation({
                                        ...newObligation,
                                        hasMeetings: e.target.checked,
                                    })
                                }
                                disabled={newObligation.isClass}
                            />
                            {" "}Has Meeting Times?
                        </label>
                    </div>

                    {(newObligation.isClass || newObligation.hasMeetings) && (
                        <div>
                            <h4>Meeting Times</h4>

                            {newObligation.meetingTimes.map((m, i) => (
                                <p key={i}>
                                    {m.day}: {m.start}–{m.end}
                                </p>
                            ))}

                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                <select
                                    value={newMeeting.day}
                                    onChange={(e) =>
                                        setNewMeeting({ ...newMeeting, day: e.target.value })
                                    }
                                >
                                    {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d) => (
                                        <option key={d} value={d}>
                                            {d}
                                        </option>
                                    ))}
                                </select>

                                <input
                                    type="time"
                                    value={newMeeting.start}
                                    onChange={(e) =>
                                        setNewMeeting({ ...newMeeting, start: e.target.value })
                                    }
                                />

                                <input
                                    type="time"
                                    value={newMeeting.end}
                                    onChange={(e) =>
                                        setNewMeeting({ ...newMeeting, end: e.target.value })
                                    }
                                />

                                <button onClick={addMeetingTime}>Add Meeting</button>
                            </div>
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.75rem" }}>
                        <div>
                            <label>Priority (% within bucket)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={newObligation.priority}
                                onChange={(e) =>
                                    setNewObligation({
                                        ...newObligation,
                                        priority: parseInt(e.target.value || "0", 10),
                                    })
                                }
                            />
                        </div>

                        <div>
                            <label>Max Stretch (hours)</label>
                            <input
                                type="number"
                                step="0.5"
                                min={0}
                                value={newObligation.maxStretch}
                                onChange={(e) =>
                                    setNewObligation({
                                        ...newObligation,
                                        maxStretch: parseFloat(e.target.value || "0"),
                                    })
                                }
                            />
                        </div>
                    </div>

                    <button style={{ marginTop: "0.5rem" }} onClick={addObligation}>
                        Add Obligation
                    </button>
                </section>

                {/* ========== Existing Obligations per Bucket ========== */}
                <section>
                    <h2>Bucket Details</h2>

                    {buckets.map((bkt, bIdx) => {
                        const total = bkt.obligations.reduce((s, o) => s + o.priority, 0);
                        return (
                            <div key={bkt.name + bIdx} style={{ marginBottom: "1.25rem" }}>
                                <h3 style={{ marginBottom: "0.25rem" }}>
                                    {bkt.name} Obligations
                                </h3>

                                {bkt.obligations.length === 0 ? (
                                    <p style={{ opacity: 0.8 }}>No obligations added yet.</p>
                                ) : (
                                    <ul>
                                        {bkt.obligations.map((o, oIdx) => (
                                            <li key={o.name + oIdx}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                                                    <div>
                                                        <strong>{o.name}</strong>{" "}
                                                        <span style={{ opacity: 0.85 }}>
                              ({o.isClass ? "Class" : o.hasMeetings ? "Has meetings" : "Flexible"})
                            </span>
                                                        <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>
                                                            Max stretch: {o.maxStretch}h
                                                        </div>
                                                    </div>

                                                    <div style={{ minWidth: 220 }}>
                                                        <div style={{ fontSize: "0.85rem", marginBottom: 4 }}>
                                                            {o.priority}% in {bkt.name}
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min={0}
                                                            max={100}
                                                            value={o.priority}
                                                            onChange={(e) =>
                                                                handleObligationPriorityChange(
                                                                    bIdx,
                                                                    oIdx,
                                                                    parseInt(e.target.value, 10)
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </div>

                                                {o.meetingTimes.length > 0 && (
                                                    <div style={{ marginTop: 4, fontSize: "0.9rem", opacity: 0.9 }}>
                                                        {o.meetingTimes.map((m, i) => (
                                                            <div key={i}>
                                                                {m.day}: {m.start}–{m.end}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <p style={{ marginTop: 6 }}>
                                    Total obligation priority in <strong>{bkt.name}</strong>:{" "}
                                    <strong>{total}%</strong> (auto-balanced to 100)
                                </p>
                            </div>
                        );
                    })}
                </section>

                <button onClick={saveProfile}>Save Profile</button>
            </div>
        </div>
    );
}
