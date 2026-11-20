import { useEffect, useState } from "react";
import { countdown } from "../utils/functions/countdown";

const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, "0");

const CountDown = () => {
    const [today, setToday] = useState(() => new Date());

    useEffect(() => {
        const timer = window.setInterval(() => setToday(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const remaining = Math.max(0, countdown(DAY_MS, start.getTime(), today.getTime()));
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);

    return (
        <div className="mt-4 text-sm text-gray-600">
            Today ends in <span className="font-mono font-semibold text-green-700">{pad(hours)}:{pad(minutes)}:{pad(seconds)}</span>
        </div>
    );
};

export default CountDown;
