import { /*useEffect,*/ useState } from "react";

const CountDown=()=>{
    const [today, _setToday] = useState(new Date());

    // useEffect(()=>{
    //     setToday(new Date());
    // },[today]);

    return(
        <div>{JSON.stringify(today).substring(1,JSON.stringify(today).length-1)}</div>
    )
}

export default CountDown;