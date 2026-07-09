import type { ActionType } from "../../types/action";

const Action=({item, isSelected}:{item:ActionType, isSelected:boolean})=>{
    return(
        <div className="border rounded-full w-12 h-12 flex items-center justify-center">
            {<item.icon className="w-6"/>}
        </div>
    )
}

export default Action;