import { useMemo } from "react";
import {
    RiHome5Line,
    RiServiceLine,
    RiListCheck3,
    RiInformationLine,
    RiPhoneLine,
    RiBuildingLine,
    RiMapPinLine,
} from "react-icons/ri";

import type { ActionType } from "../types/action";
import { useLanguage } from "../i18n";
import Navbar from "./Landing/Navbar";
import Hero from "./Landing/Hero";
import Services from "./Landing/Services";
import Commercial from "./Landing/Commercial";
import Partners from "./Landing/Partners";
import Process from "./Landing/Process";
import WhyLoveLaundry from "./Landing/WhyLoveLaundry";
import JoinWithUs from "./Landing/JoinWithUs";
import Testimonials from "./Landing/Testimonials";
import LocationMap from "./Landing/LocationMap";
import Contact from "./Landing/Contact";
import Footer from "./Landing/Footer";
import BookingBanner from "./Landing/BookingBanner";
import ChatWidget from "../components/ChatWidget";


const LandingPage = () => {
    const { t } = useLanguage();

    const actions: ActionType[] = useMemo(
        () => [
            {
                id: "home",
                label: t("actionHome"),
                icon: RiHome5Line,
            },
            {
                id: "services",
                label: t("actionServices"),
                icon: RiServiceLine,
            },
            {
                id: "commercial",
                label: t("actionCommercial"),
                icon: RiBuildingLine,
            },
            {
                id: "process",
                label: t("actionHowItWorks"),
                icon: RiListCheck3,
            },
            {
                id: "about",
                label: t("actionWhyUs"),
                icon: RiInformationLine,
            },
            {
                id: "locations",
                label: t("actionLocations"),
                icon: RiMapPinLine,
            },
            {
                id: "contact",
                label: t("actionContact"),
                icon: RiPhoneLine,
            },
        ],
        [t]
    );

    return (
        <main className="site-page min-h-screen overflow-x-hidden bg-surface text-ink">

            <Navbar actions={actions}/>
            <Hero />
            <BookingBanner />
            <Services />
            <Commercial />
            <Partners />
            <Process />
            <WhyLoveLaundry />
            <BookingBanner />
            <JoinWithUs />
            <Testimonials />
            <LocationMap />
            <Contact />
            <Footer />
            <ChatWidget />
        </main>
    );
};

export default LandingPage;
