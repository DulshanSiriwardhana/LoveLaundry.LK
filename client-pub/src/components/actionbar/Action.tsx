import type { ActionType } from "../../types/action";
import { navigateTo } from "../../hooks/useRoute";

const Action = ({ item, isSelected, setSelected }: { item: ActionType, isSelected: boolean, setSelected: (e: ActionType) => void }) => {
    return (
        <button
            type="button"
            aria-label={item.name}
            aria-current={isSelected ? "page" : undefined}
            onClick={() => {
                setSelected(item);
                navigateTo(item.path);
            }}
            className={`border rounded-full w-12 h-12 flex items-center justify-center transition-colors duration-200 ${isSelected ? "bg-[var(--brand-dark)] text-[var(--ll-white)]" : "bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"}`}
        >
            <item.icon className="w-6" />
        </button>
    );
};

export default Action;
