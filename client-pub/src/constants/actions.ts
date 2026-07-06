import { FaDoorOpen, FaHome, FaQuestionCircle, FaUser } from "react-icons/fa"
import type { ActionType } from "../types/action";

export const actions: ActionType[] = [
    {
        name: "home",
        path: "/",
        icon: FaHome
    },
    {
        name: "about",
        path: "/about",
        icon: FaQuestionCircle
    },
    {
        name: "work",
        path: "/work",
        icon: FaUser
    },
    {
        name: "join",
        path: "/join",
        icon: FaDoorOpen
    }
];