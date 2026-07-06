import { useEffect, useState } from "react";

const CountDown=()=>{
    const [today, setToday] = useState(new Date());

    useEffect(()=>{
        setToday(new Date());
    },[today]);

    return(
        <div>{today.getMilliseconds()}</div>
    )
}

export default CountDown;