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
            className={`border rounded-full w-12 h-12 flex items-center justify-center transition-colors duration-200 ${isSelected ? "bg-green-600 text-white" : "bg-white text-black hover:bg-green-100"}`}
        >
            <item.icon className="w-6" />
        </button>
    );
};

export default Action;
