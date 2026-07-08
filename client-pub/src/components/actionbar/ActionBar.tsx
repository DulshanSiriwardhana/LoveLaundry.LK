import type { ActionType } from "../../types/action";
import Action from "./Action";

const ActionBar=({items, selectedItem}:{items:ActionType[], selectedItem:ActionType})=>{
    return(
        <div className="max-w-[480px] min-w-[320px] border-2 fixed bottom-20 h-12 rounded-xl w-full border-green-600 flex items-center justify-center">
            {
                items.map((item)=>(
                    <Action item={item} isSelected={selectedItem===item}/>
                ))
            }
        </div>
    )
}

export default ActionBar;