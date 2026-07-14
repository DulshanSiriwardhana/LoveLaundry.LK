import type { ActionType } from "../../types/action";
import Action from "./Action";

const ActionBar=({items, selectedItem, setSelectedItem}:{items:ActionType[], selectedItem:ActionType, setSelectedItem:(e: ActionType)=>void})=>{

    return(
        <div className="max-w-[480px] min-w-[320px] border-2 fixed bottom-20 h-12 rounded-xl w-full border-green-600 flex items-center justify-center gap-12">
            {
                items.map((item, index)=>(
                    <div key={index} style={{order:`${10-index}`}} className="transition-all duration-300">
                        <Action item={item} isSelected={selectedItem===item} setSelected={setSelectedItem}/>
                    </div>
                ))
            }
        </div>
    )
}

export default ActionBar;