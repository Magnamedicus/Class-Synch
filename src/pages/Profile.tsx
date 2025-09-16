import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import "../css/Profile.css";
import bgImage from "../assets/profile_bg.png";

/* =======================
   Types (unchanged)
======================= */

interface MeetingTime {
    day: string;
    start: string; // "HH:mm"
    end: string;   // "HH:mm"
}

interface Obligation {
    name: string;
    bucketName: string;
    isClass: boolean;
    hasMeetings: boolean;
    meetingTimes: MeetingTime[];
    priority: number;   // % within bucket (0-100)
    maxStretch: number; // hours
    preferredTimeBlocks?: string[]; // multi-select: ["morning","afternoon","evening","night"]
    __preset?: boolean; // true for "Night Sleep"
}

interface Bucket {
    name: string;      // "School Work" | "Sleep" | user-defined
    priority: number;  // % of week (0-100). Sleep must be >= 25.
    obligations: Obligation[];
}

interface Profile {
    username: string;
    email: string;
    password: string;
    buckets: Bucket[];
}

/* =======================
   Constants (unchanged)
======================= */

const SLEEP_BUCKET = "Sleep";
const NIGHT_SLEEP = "Night Sleep";
const MIN_SLEEP = 25;
const TIME_CHOICES = ["morning", "afternoon", "evening", "night"] as const;

/* =======================
   Helpers (unchanged logic)
======================= */

function createSleepBucket(priority = 25): Bucket {
    return {
        name: SLEEP_BUCKET,
        priority: Math.max(MIN_SLEEP, Math.min(100, Math.round(priority))),
        obligations: [
            {
                name: NIGHT_SLEEP,
                bucketName: SLEEP_BUCKET,
                isClass: false,
                hasMeetings: false,
                meetingTimes: [],
                priority: 100,
                maxStretch: 8,
                preferredTimeBlocks: ["night"],
                __preset: true,
            },
        ],
    };
}

function normalizeProfile(raw: any): Profile {
    const username = String(raw?.username ?? "");
    const email = String(raw?.email ?? "");
    const password = String(raw?.password ?? "");

    const rawBuckets: any[] = Array.isArray(raw?.buckets) ? raw.buckets : [];

    let buckets: Bucket[] = rawBuckets.map((b: any) => {
        const name = String(b?.name ?? "Unnamed");
        const priority = Number.isFinite(b?.priority) ? Math.max(0, Math.min(100, b.priority)) : 0;

        const obligations: Obligation[] = Array.isArray(b?.obligations)
            ? b.obligations.map((o: any) => ({
                name: String(o?.name ?? "Unnamed obligation"),
                bucketName: name,
                isClass: !!o?.isClass,
                hasMeetings: !!o?.hasMeetings,
                meetingTimes: Array.isArray(o?.meetingTimes)
                    ? o.meetingTimes.map((m: any) => ({
                        day: String(m?.day ?? "Monday"),
                        start: String(m?.start ?? "09:00"),
                        end: String(m?.end ?? "10:00"),
                    }))
                    : [],
                priority: Number.isFinite(o?.priority) ? Math.max(0, Math.min(100, o.priority)) : 0,
                maxStretch: Number.isFinite(o?.maxStretch) ? o.maxStretch : 2,
                preferredTimeBlocks: Array.isArray(o?.preferredTimeBlocks)
                    ? o.preferredTimeBlocks.filter((x: any) =>
                        (TIME_CHOICES as readonly string[]).includes(x)
                    )
                    : undefined,
                __preset: !!o?.__preset,
            }))
            : [];

        return { name, priority, obligations };
    });

    if (!buckets.some((b) => b.name === "School Work")) {
        buckets.push({ name: "School Work", priority: 75, obligations: [] });
    }

    const sleepIndex = buckets.findIndex((b) => b.name === SLEEP_BUCKET);
    if (sleepIndex === -1) {
        buckets.push(createSleepBucket(25));
    } else {
        const current = buckets[sleepIndex];
        const sleepPriority = Math.max(
            MIN_SLEEP,
            Math.min(100, Math.round(current.priority || MIN_SLEEP))
        );

        let sleepObligations: Obligation[] = current.obligations || [];
        const presetIdx = sleepObligations.findIndex((o) => o.name === NIGHT_SLEEP);
        if (presetIdx === -1) {
            sleepObligations = [createSleepBucket().obligations[0]];
        } else {
            sleepObligations = [
                {
                    ...sleepObligations[presetIdx],
                    name: NIGHT_SLEEP,
                    bucketName: SLEEP_BUCKET,
                    isClass: false,
                    hasMeetings: false,
                    meetingTimes: [],
                    priority: 100,
                    maxStretch: Number.isFinite(sleepObligations[presetIdx]?.maxStretch)
                        ? sleepObligations[presetIdx].maxStretch
                        : 8,
                    preferredTimeBlocks: ["night"],
                    __preset: true,
                },
            ];
        }
        buckets[sleepIndex] = {
            name: SLEEP_BUCKET,
            priority: sleepPriority,
            obligations: sleepObligations,
        };
    }

    buckets = normalizeBucketTotalsWithSleepFloor(buckets);
    return { username, email, password, buckets };
}

function normalizeBucketTotalsWithSleepFloor(buckets: Bucket[]): Bucket[] {
    const sleepIdx = buckets.findIndex((b) => b.name === SLEEP_BUCKET);
    if (sleepIdx === -1) return buckets;

    let sleep = buckets[sleepIdx].priority;
    if (!Number.isFinite(sleep)) sleep = MIN_SLEEP;
    sleep = Math.max(MIN_SLEEP, Math.min(100, Math.round(sleep)));

    const others = buckets.map((b, i) =>
        i === sleepIdx ? 0 : Math.max(0, Math.round(b.priority || 0))
    );
    const othersSum = others.reduce((s, n) => s + n, 0);
    const remaining = Math.max(0, 100 - sleep);

    let next: Bucket[] = buckets.map((b) => ({ ...b }));
    next[sleepIdx].priority = sleep;

    if (remaining === 0) {
        next = next.map((b, i) => (i === sleepIdx ? b : { ...b, priority: 0 }));
    } else if (othersSum === 0) {
        const N = buckets.length - 1;
        const per = N > 0 ? Math.floor(remaining / N) : 0;
        next = next.map((b, i) => (i === sleepIdx ? b : { ...b, priority: per }));
        const drift =
            100 -
            (sleep +
                next
                    .filter((_, i) => i !== sleepIdx)
                    .reduce((s, b) => s + b.priority, 0));
        const fixIdx = next.findIndex((_, i) => i !== sleepIdx);
        if (fixIdx !== -1)
            next[fixIdx] = { ...next[fixIdx], priority: next[fixIdx].priority + drift };
    } else {
        next = next.map((b, i) => {
            if (i === sleepIdx) return b;
            const scaled = Math.round((others[i] / othersSum) * remaining);
            return { ...b, priority: scaled };
        });
        const sumTotal = next.reduce((s, b) => s + b.priority, 0);
        const drift = 100 - sumTotal;
        if (drift !== 0) {
            const idx = next.findIndex((_, i) => i !== sleepIdx);
            if (idx !== -1)
                next[idx] = { ...next[idx], priority: Math.max(0, next[idx].priority + drift) };
        }
    }

    return next;
}

function rebalance<T extends { priority: number }>(
    items: T[],
    changedIndex: number,
    newValue: number
): T[] {
    const len = items.length;
    if (len === 0) return items;
    if (len === 1) return [{ ...items[0], priority: 100 }];

    const target = Math.max(0, Math.min(100, Math.round(newValue)));
    const othersTotalBefore = items.reduce(
        (s, it, idx) => (idx === changedIndex ? s : s + it.priority),
        0
    );
    const remaining = Math.max(0, 100 - target);
    const anyOthers = othersTotalBefore > 0;

    let result = items.map((it, idx) => {
        if (idx === changedIndex) return { ...it, priority: target };
        if (!anyOthers) {
            const per = Math.floor(remaining / (len - 1));
            return { ...it, priority: per };
        } else {
            const scaled = Math.round((it.priority / othersTotalBefore) * remaining);
            return { ...it, priority: scaled };
        }
    });

    const sum = result.reduce((s, it) => s + it.priority, 0);
    const diff = 100 - sum;
    if (diff !== 0) {
        let idxToFix = result.findIndex((_, idx) => idx !== changedIndex);
        if (idxToFix === -1) idxToFix = changedIndex;
        const fixed = Math.max(0, Math.min(100, result[idxToFix].priority + diff));
        result[idxToFix] = { ...result[idxToFix], priority: fixed };
    }

    return result;
}

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
   Component (UI-only changes)
======================= */

export default function ProfilePage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [buckets, setBuckets] = useState<Bucket[]>([
        { name: "School Work", priority: 75, obligations: [] },
        createSleepBucket(25),
    ]);

    const [newBucketName, setNewBucketName] = useState("");

    const [newObligation, setNewObligation] = useState<Obligation>({
        name: "",
        bucketName: "School Work",
        isClass: false,
        hasMeetings: false,
        meetingTimes: [],
        priority: 0,
        maxStretch: 2,
    });

    const [newMeeting, setNewMeeting] = useState<MeetingTime>({
        day: "Monday",
        start: "09:00",
        end: "10:00",
    });

    useEffect(() => {
        const stored = localStorage.getItem("activeProfile");
        if (stored) {
            const normalized = normalizeProfile(JSON.parse(stored));
            setProfile(normalized);
            setBuckets(normalized.buckets);
            const firstNonSleep = normalized.buckets.find((b) => b.name !== SLEEP_BUCKET);
            if (firstNonSleep) {
                setNewObligation((prev) => ({ ...prev, bucketName: firstNonSleep.name }));
            }
        } else {
            const starter: Profile = { username: "", email: "", password: "", buckets };
            setProfile(starter);
        }
    }, []);

    // === Buckets ===
    const handleBucketPriorityChange = (bucketIndex: number, value: number) => {
        setBuckets((prev) => rebalanceBucketsWithSleepFloor(prev, bucketIndex, value));
    };

    const rebalanceBucketsWithSleepFloor = (
        bks: Bucket[],
        changedIndex: number,
        newValue: number
    ): Bucket[] => {
        const target = Math.max(0, Math.min(100, Math.round(newValue)));
        const copy = bks.map((b) => ({ ...b }));
        copy[changedIndex].priority = target;
        return normalizeBucketTotalsWithSleepFloor(copy);
    };

    const totalBuckets = useMemo(
        () => buckets.reduce((s, b) => s + b.priority, 0),
        [buckets]
    );

    const addBucket = () => {
        const name = newBucketName.trim();
        if (!name) return;
        if (name.toLowerCase() === SLEEP_BUCKET.toLowerCase()) {
            alert(`"${SLEEP_BUCKET}" already exists and is mandatory.`);
            return;
        }
        if (buckets.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
            alert("A bucket with that name already exists.");
            return;
        }
        const next = [...buckets, { name, priority: 10, obligations: [] }];
        setBuckets(normalizeBucketTotalsWithSleepFloor(next));
        setNewBucketName("");
        setNewObligation((prev) => ({ ...prev, bucketName: name }));
    };

    // === Obligations ===
    const addMeetingTime = () => {
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
        if (newObligation.bucketName === SLEEP_BUCKET) {
            alert(`You cannot add obligations to the "${SLEEP_BUCKET}" bucket.`);
            return;
        }

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

            const inserted: Obligation[] = [
                ...targetBucket.obligations,
                { ...newObligation, preferredTimeBlocks: newObligation.preferredTimeBlocks ?? [] },
            ];
            const newObIndex = inserted.length - 1;
            const rebalancedObligs = rebalance(inserted, newObIndex, 10);

            const updatedBucket: Bucket = { ...targetBucket, obligations: rebalancedObligs };
            const next = [...prev];
            next[idx] = updatedBucket;
            return next;
        });

        setNewObligation((prev) => ({
            name: "",
            bucketName: prev.bucketName,
            isClass: false,
            hasMeetings: false,
            meetingTimes: [],
            priority: 0,
            maxStretch: 2,
            preferredTimeBlocks: [],
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
            if (bucket.name === SLEEP_BUCKET) return copy; // locked
            const rebalanced = rebalanceBucketObligations(bucket, obligationIndex, value);
            copy[bucketIndex] = rebalanced;
            return copy;
        });
    };

    const togglePreferredTime = (
        bucketIndex: number,
        obligationIndex: number,
        slot: typeof TIME_CHOICES[number]
    ) => {
        setBuckets((prev) => {
            const copy = prev.map((b) => ({ ...b, obligations: b.obligations.map((o) => ({ ...o })) }));
            const bkt = copy[bucketIndex];
            const ob = bkt.obligations[obligationIndex];

            if (bkt.name === SLEEP_BUCKET || ob.__preset) return prev;

            const current = Array.isArray(ob.preferredTimeBlocks) ? ob.preferredTimeBlocks : [];
            const has = current.includes(slot);
            const next = has ? current.filter((x) => x !== slot) : [...current, slot];
            ob.preferredTimeBlocks = next;
            return copy;
        });
    };

    // === Save ===
    const saveProfile = () => {
        if (!profile) return;

        const bad = buckets.find(
            (b) =>
                b.name !== SLEEP_BUCKET &&
                b.obligations.length > 0 &&
                b.obligations.reduce((s, o) => s + o.priority, 0) !== 100
        );
        if (bad) {
            alert(`Obligations in bucket "${bad.name}" must total 100%. Adjust sliders first.`);
            return;
        }

        const normalized = normalizeBucketTotalsWithSleepFloor(buckets);
        if (normalized.reduce((s, b) => s + b.priority, 0) !== 100) {
            alert("Bucket priorities must total exactly 100%.");
            return;
        }
        const sleep = normalized.find((b) => b.name === SLEEP_BUCKET);
        if (!sleep || sleep.priority < MIN_SLEEP) {
            alert(`"${SLEEP_BUCKET}" must be at least ${MIN_SLEEP}%.`);
            return;
        }

        const fixed = normalized.map((b) =>
            b.name === SLEEP_BUCKET ? createSleepBucket(b.priority) : b
        );

        const updated: Profile = { ...profile, buckets: fixed };
        localStorage.setItem("activeProfile", JSON.stringify(updated));

        const userRaw = localStorage.getItem("user");
        if (userRaw) {
            const user = JSON.parse(userRaw);
            localStorage.setItem("user", JSON.stringify({ ...user, buckets: updated.buckets }));
        }

        setProfile(updated);
        setBuckets(updated.buckets);
        alert("✅ Profile saved!");
    };

    if (!profile) {
        return (
            <div className="profile-page">
                <Navbar />
                <div className="profile-empty">
                    <h1>No profile found.</h1>
                    <p>Go back to Home and create or log into a profile.</p>
                </div>
            </div>
        );
    }

    const nonSleepBuckets = buckets.filter((b) => b.name !== SLEEP_BUCKET);

    // ——— Chip row UI (no logic change) ———
    const ChipRow: React.FC<{
        value: string[] | undefined;
        lockedNight?: boolean;
        onToggle: (slot: typeof TIME_CHOICES[number]) => void;
    }> = ({ value = [], lockedNight = false, onToggle }) => {
        return (
            <div className="chip-row">
                {TIME_CHOICES.map((slot) => {
                    const selected = lockedNight ? slot === "night" : value.includes(slot);
                    const disabled = lockedNight ? slot !== "night" : false;
                    return (
                        <label
                            key={slot}
                            className={`chip ${selected ? "is-selected" : ""} ${
                                disabled ? "is-disabled" : ""
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={selected}
                                disabled={disabled}
                                onChange={() => onToggle(slot)}
                            />
                            <span className="chip-text">{slot}</span>
                        </label>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="profile-page">
            <Navbar />

            {/* Hero background with parallax glow */}
            <div
                className="profile-hero"
                style={{ backgroundImage: `url(${bgImage})` }}
            >
                <div className="profile-hero__scrim" />
                <div className="profile-hero__copy">
                    <h1 className="profile-hero__title">
                        Class Synch Profile
                    </h1>
                    <p className="profile-hero__subtitle">
                        Effortless learning. Perfect synchronization.
                    </p>
                </div>
            </div>

            {/* Main card */}
            <div className="profile-container animate-in">
                <h2 className="section-title">
                    Welcome, {profile.username || "Student"}!
                </h2>
                <p className="section-subtitle">
                    Configure your weekly buckets, obligations, and preferences.
                </p>

                {/* ========== Buckets ========== */}
                <section className="card">
                    <div className="card-header">
                        <h3>Buckets (must total 100%)</h3>
                    </div>

                    <div className="bucket-list">
                        {buckets.map((b, i) => {
                            const isSleep = b.name === SLEEP_BUCKET;
                            return (
                                <div className="bucket-row" key={b.name + i}>
                                    <div className="bucket-row__label">
                                        <strong>{b.name}</strong>{" "}
                                        {isSleep && <em className="hint">(min {MIN_SLEEP}%)</em>}
                                    </div>
                                    <div className="bucket-row__value">{b.priority}%</div>
                                    <input
                                        className="range"
                                        type="range"
                                        min={isSleep ? MIN_SLEEP : 0}
                                        max={100}
                                        value={b.priority}
                                        onChange={(e) =>
                                            handleBucketPriorityChange(i, parseInt(e.target.value, 10))
                                        }
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="bucket-total">
                        Total: <strong>{totalBuckets}%</strong> (must equal 100)
                    </div>

                    <div className="add-row">
                        <input
                            type="text"
                            placeholder="New bucket name"
                            value={newBucketName}
                            onChange={(e) => setNewBucketName(e.target.value)}
                        />
                        <button className="btn btn-primary" onClick={addBucket}>
                            Add Bucket
                        </button>
                    </div>
                    <p className="help">
                        You can’t add or remove the “{SLEEP_BUCKET}” bucket.
                    </p>
                </section>

                {/* ========== New Obligation ========== */}
                <section className="card">
                    <div className="card-header">
                        <h3>Add Obligation</h3>
                    </div>

                    <div className="grid-2">
                        <div className="field">
                            <label>Name</label>
                            <input
                                type="text"
                                placeholder="Obligation name"
                                value={newObligation.name}
                                onChange={(e) =>
                                    setNewObligation({ ...newObligation, name: e.target.value })
                                }
                            />
                        </div>

                        <div className="field">
                            <label>Bucket</label>
                            <select
                                value={newObligation.bucketName}
                                onChange={(e) =>
                                    setNewObligation({
                                        ...newObligation,
                                        bucketName: e.target.value,
                                    })
                                }
                            >
                                {nonSleepBuckets.map((b) => (
                                    <option key={b.name} value={b.name}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="inline">
                        <label className="check">
                            <input
                                type="checkbox"
                                checked={newObligation.isClass}
                                onChange={(e) =>
                                    setNewObligation({
                                        ...newObligation,
                                        isClass: e.target.checked,
                                        hasMeetings: e.target.checked
                                            ? true
                                            : newObligation.hasMeetings,
                                    })
                                }
                            />
                            <span>Is Class?</span>
                        </label>

                        <label className="check">
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
                            <span>Has Meeting Times?</span>
                        </label>
                    </div>

                    {(newObligation.isClass || newObligation.hasMeetings) && (
                        <div className="meeting-card">
                            <h4>Meeting Times</h4>

                            {newObligation.meetingTimes.length > 0 && (
                                <div className="meeting-list">
                                    {newObligation.meetingTimes.map((m, i) => (
                                        <div className="meeting-pill" key={i}>
                                            <span>{m.day}</span>
                                            <span>
                        {m.start}–{m.end}
                      </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="meeting-add">
                                <select
                                    value={newMeeting.day}
                                    onChange={(e) =>
                                        setNewMeeting({ ...newMeeting, day: e.target.value })
                                    }
                                >
                                    {[
                                        "Monday",
                                        "Tuesday",
                                        "Wednesday",
                                        "Thursday",
                                        "Friday",
                                        "Saturday",
                                        "Sunday",
                                    ].map((d) => (
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

                                <button className="btn" onClick={addMeetingTime}>
                                    Add Meeting
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid-2">
                        <div className="field">
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

                        <div className="field">
                            <label>Max Session Length (hours)</label>
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

                    <button className="btn btn-primary" onClick={addObligation}>
                        Add Obligation
                    </button>
                </section>

                {/* ========== Existing Obligations per Bucket ========== */}
                <section className="card">
                    <div className="card-header">
                        <h3>Bucket Details</h3>
                    </div>

                    {buckets.map((bkt, bIdx) => {
                        const isSleep = bkt.name === SLEEP_BUCKET;
                        const total = bkt.obligations.reduce((s, o) => s + o.priority, 0);

                        return (
                            <div className="bucket-block" key={bkt.name + bIdx}>
                                <h4 className="bucket-title">
                                    {bkt.name}{" "}
                                    {isSleep && <span className="badge">preset</span>}
                                </h4>

                                {bkt.obligations.length === 0 ? (
                                    <p className="muted">No obligations added yet.</p>
                                ) : (
                                    <ul className="obligation-list">
                                        {bkt.obligations.map((o, oIdx) => {
                                            const lockedNight = isSleep || o.__preset;
                                            const meta = lockedNight
                                                ? "(Preset, pinned to night)"
                                                : o.isClass
                                                    ? "(Class)"
                                                    : o.hasMeetings
                                                        ? "(Has meetings)"
                                                        : "(Flexible)";

                                            return (
                                                <li className="obligation-card" key={o.name + oIdx}>
                                                    <div className="obligation-head">
                                                        <div>
                                                            <div className="obligation-name">{o.name}</div>
                                                            <div className="obligation-meta">{meta}</div>
                                                            <div className="obligation-meta">
                                                                Max stretch: {o.maxStretch}h
                                                            </div>
                                                        </div>

                                                        {!isSleep ? (
                                                            <div className="obligation-slider">
                                                                <div className="slider-label">
                                                                    {o.priority}% in {bkt.name}
                                                                </div>
                                                                <input
                                                                    className="range"
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
                                                        ) : (
                                                            <div className="sleep-locked">
                                                                100% of Sleep bucket
                                                            </div>
                                                        )}
                                                    </div>

                                                    {o.meetingTimes.length > 0 && (
                                                        <div className="meeting-list compact">
                                                            {o.meetingTimes.map((m, i) => (
                                                                <div className="meeting-pill" key={i}>
                                                                    <span>{m.day}</span>
                                                                    <span>
                                    {m.start}–{m.end}
                                  </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <ChipRow
                                                        value={o.preferredTimeBlocks}
                                                        lockedNight={lockedNight}
                                                        onToggle={(slot) => togglePreferredTime(bIdx, oIdx, slot)}
                                                    />
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}

                                <p className="bucket-total">
                                    Total obligation priority in <strong>{bkt.name}</strong>:{" "}
                                    <strong>{total}%</strong>
                                    {!isSleep && <span> (auto-balanced to 100)</span>}
                                </p>
                            </div>
                        );
                    })}
                </section>

                <div className="save-row">
                    <button className="btn btn-primary btn-lg" onClick={saveProfile}>
                        Save Profile
                    </button>
                </div>
            </div>
        </div>
    );
}
