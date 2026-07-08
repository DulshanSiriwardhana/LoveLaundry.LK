import type { ActionType } from "../../types/action";

const Action=({item, isSelected}:{item:ActionType, isSelected:boolean})=>{
    return(
        <div>
            {(item.icon)}
        </div>
    )
}

export default Action;