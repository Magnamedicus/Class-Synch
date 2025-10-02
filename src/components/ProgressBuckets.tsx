import React from "react";
import "../css/ProgressBuckets.css";

export type ProgressBucket = {
    id: string;
    label: string;
    count: number;                  // number of *visible* questions in bucket
    offset: number;                 // visible-index offset of bucket start
    firstVisibleLinearIndex: number | null;
};

export interface ProgressBucketsProps {
    buckets: ProgressBucket[];
    totalVisible: number;
    completedVisible: number;
    currentBucketId: string | null;
    onJumpToBucket: (id: string) => void;
    getBucketIcon?: (bucketId: string) => string | undefined;
    style?: React.CSSProperties;
}

const ProgressBuckets: React.FC<ProgressBucketsProps> = ({
                                                             buckets,
                                                             totalVisible,
                                                             completedVisible,
                                                             currentBucketId,
                                                             onJumpToBucket,
                                                             getBucketIcon,
                                                             style,
                                                         }) => {
    const pct =
        totalVisible > 0
            ? Math.min(100, Math.max(0, (completedVisible / totalVisible) * 100))
            : 0;

    // place bulb at the *start* of its bucket
    const startPct = (b: ProgressBucket) =>
        totalVisible ? (b.offset / totalVisible) * 100 : 0;

    const doneCount = (b: ProgressBucket) =>
        Math.max(0, Math.min(b.count, completedVisible - b.offset));

    return (
        <div
            className="cs-bulb-root"
            role="region"
            aria-label="Questionnaire progress"
            style={style}
        >
            <div className="cs-bulb-track">
                <div className="cs-bulb-ambient" aria-hidden="true" />
                <div className="cs-bulb-gloss" aria-hidden="true" />
                <div className="cs-bulb-fill" style={{ width: `${pct}%` }}>
                    <div className="cs-bulb-sheen" />
                </div>

                {buckets.map((b) => {
                    const left = startPct(b);
                    const disabled = b.count === 0 || b.firstVisibleLinearIndex === null;
                    const active = b.id === currentBucketId;
                    const isDone = doneCount(b) === b.count && b.count > 0;
                    const icon = getBucketIcon?.(b.id);

                    return (
                        <button
                            key={b.id}
                            type="button"
                            className={[
                                "cs-bulb-dot",
                                active ? "is-active" : "",
                                isDone ? "is-done" : "",
                                icon ? "has-img" : "no-img",
                            ].join(" ")}
                            style={{ left: `${left}%` }}
                            disabled={disabled}
                            onClick={() => !disabled && onJumpToBucket(b.id)}
                            aria-label={
                                b.count > 0
                                    ? `${b.label} — ${doneCount(b)}/${b.count}`
                                    : `${b.label} — no visible questions`
                            }
                            title={b.label}
                        >
                            <span className="cs-bulb-shadow" />
                            <span className="cs-bulb-body">
                {icon ? (
                    <span
                        className="cs-bulb-img"
                        style={{ backgroundImage: `url(${icon})` }}
                    />
                ) : (
                    <span className="cs-bulb-orb" />
                )}
              </span>

                            {/* Caption across landmark */}
                            <span className="cs-bulb-caption" aria-hidden="true">
                {b.label}
              </span>

                            <span className="cs-bulb-ring" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ProgressBuckets;
