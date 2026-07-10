import { useEffect, useState } from "react";
import type { ActionType } from "../../types/action";

const Action=({item, isSelected, setSelected}:{item:ActionType, isSelected:boolean, setSelected: (e:ActionType)=>void})=>{
    const [bgcolor, setBgcolor] = useState<null | string>(null);

    useEffect(()=>{
        if(isSelected) setBgcolor("green");
        else setBgcolor(null);
    },[isSelected]);

    if (isSelected){  return (
        <div style={{backgroundColor: `${bgcolor}`}} className="border rounded-full w-12 h-12 flex items-center justify-center" onClick={()=>setSelected(item)}>
            {<item.icon className="w-6"/>}
        </div>
        )} else {
            return(
        <div className="border rounded-full w-12 h-12 flex items-center justify-center" onClick={()=>setSelected(item)}>
            {<item.icon className="w-6"/>}
        </div>
    )}
}

export default Action;