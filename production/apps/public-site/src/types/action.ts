import type { ComponentType } from "react";

export interface ActionType {
    id: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
}