import type { ActionType } from "../../types/action";

const Action=({item, isSelected, setSelected}:{item:ActionType, isSelected:boolean, setSelected: (e:ActionType)=>void})=>{

    return(
        <div style={{backgroundColor: `${isSelected && "green"}`}} className="border rounded-full w-12 h-12 flex items-center justify-center" onClick={()=>setSelected(item)}>
            {<item.icon className="w-6"/>}
        </div>
    )
}

export default Action;