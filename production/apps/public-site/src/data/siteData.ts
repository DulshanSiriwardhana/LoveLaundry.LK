import {
    RiCalendarCheckLine,
    RiTruckLine,
    RiSparklingLine,
    RiHomeSmileLine,
    RiShoppingBasket2Line,
    RiStarFill,
    RiTimeLine,
    RiShieldCheckLine,
    RiHeart3Fill,
    RiHotelLine,
    RiBuildingLine,
    RiScales3Line,
    RiUserStarLine,
    RiMoneyRupeeCircleLine,
    RiTeamLine,
    RiAwardLine,
} from "react-icons/ri";
import type { IconType } from "react-icons";

import { COMPANY } from "./constants";

// Re-export for backward compatibility
export const companyInfo = {
    name: COMPANY.name,
    tagline: COMPANY.tagline,
    description: COMPANY.description,
    // How the business actually operates — use this copy everywhere:
    // hotels: collect soiled linen, deliver it back clean;
    // public: hand over / collect at the laundry counter or a partner shop;
    // partner shops: collect clothes from the shop, clean, return to the shop.
    // No home pickup or home delivery for the public.
    phone: COMPANY.phoneFull,
    whatsapp: COMPANY.whatsappFull,
    email: COMPANY.email,
    address: COMPANY.address.full,
    rating: COMPANY.stats.rating,
    serviceCount: COMPANY.stats.serviceCount,
    availability: COMPANY.stats.availability,
    customerCount: COMPANY.stats.customerCount,
};

// Hero Section Data
export const heroData = {
    badge: {
        icon: RiHeart3Fill,
        text: "Hotel Linen Specialists",
    },
    title: {
        main: "Fresh linens.",
        highlight: "Trusted by hotels.",
    },
    description:
        "Hotel linen collection and delivery for years. For the public, hand over and collect at our laundry counter or a partner shop.",
    buttons: {
        primary: {
            text: "Find a drop-off point",
            scrollTo: "locations",
        },
        secondary: {
            text: "Explore Services",
            scrollTo: "services",
        },
    },
    stats: [
        {
            icon: RiShoppingBasket2Line,
            value: companyInfo.serviceCount,
            label: "Services",
        },
        {
            icon: RiStarFill,
            value: companyInfo.rating,
            label: "Customer rating",
        },
        {
            icon: RiTimeLine,
            value: companyInfo.availability,
            label: "Convenience",
        },
    ],
    image: {
        src: "./assets/images/love-laundry-hero.png",
        alt: "Love Laundry hotel linen and counter service",
    },
    badge_text: {
        primary: "Love Laundry",
        secondary: "Schedule yours today",
    },
};

// Services Section Data
export interface Service {
    title: string;
    subtitle: string;
    description: string;
    image: string;
}

export const services: Service[] = [
    {
        title: "Wash & Fold",
        subtitle: "Everyday Laundry",
        description:
            "Professional washing, drying and folding for your everyday clothes.",
        image: "./assets/images/services/wash-fold.jpg",
    },
    {
        title: "Ironing",
        subtitle: "Crisp & Perfect",
        description:
            "Freshly pressed clothes that look clean, sharp and ready to wear.",
        image: "./assets/images/services/ironing.jpg",
    },
    {
        title: "Dry Cleaning",
        subtitle: "Special Care",
        description:
            "Specialized cleaning for suits, dresses and delicate garments.",
        image: "./assets/images/services/dry-cleaning.jpg",
    },
    {
        title: "Shop Drop-off & Collection",
        subtitle: "Partner Shops",
        description:
            "Hand clothes in at a partner shop. We collect from the shop, clean, and deliver back to the same shop.",
        image: "./assets/images/services/pickup-delivery.jpg",
    },
];

export const servicesSection = {
    badge: "Our Services",
    title: {
        main: "Everything your",
        highlight: "clothes need.",
    },
    description: "",
    cta: {
        text: "Not sure which service you need?",
        subtext: "Talk to our team and we'll help you choose.",
        buttonText: "Contact Us",
    },
};

// Commercial/Hotel Services Section Data
export interface CommercialService {
    icon: IconType;
    title: string;
    subtitle: string;
    description: string;
    features: string[];
}

export const commercialServices: CommercialService[] = [
    {
        icon: RiHotelLine,
        title: "Hotel Linen Service",
        subtitle: "Years of Experience",
        description:
            "We collect soiled linen from hotels, wash it to hotel standards and deliver it back clean, pressed and guest-ready.",
        features: [
            "Bed sheets & pillowcases",
            "Towels & bathrobes",
            "Table linens",
            "Curtains & duvets",
        ],
    },
    {
        icon: RiBuildingLine,
        title: "Commercial Laundry",
        subtitle: "Business Solutions",
        description:
            "Reliable laundry services for restaurants, spas, salons, gyms, and medical facilities with flexible scheduling.",
        features: [
            "Restaurant linens",
            "Spa & salon towels",
            "Gym towels & uniforms",
            "Medical facility linens",
        ],
    },
    {
        icon: RiScales3Line,
        title: "Scheduled Collection",
        subtitle: "High Volume Care",
        description:
            "Regular collection from hotels and partner shops, with delivery back on a fixed schedule. No home collections.",
        features: [
            "Daily/weekly hotel collection",
            "Delivery back to your premises",
            "Dedicated account contact",
            "Competitive bulk pricing",
        ],
    },
];

export const commercialSection = {
    badge: "Commercial Services",
    title: {
        main: "Professional linen care for",
        highlight: "hotels & businesses.",
    },
    description:
        "Bulk washing and specialty care for hotels, restaurants, spas and businesses.",
    cta: {
        text: "Need commercial laundry solutions?",
        subtext: "Get a custom quote for your business needs.",
        buttonText: "Request Quote",
    },
};

// Partners Section Data
export interface Partner {
    name: string;
    image: string;
    description: string;
    years: number;
    location: string;
}

export const partnersSection = {
    badge: "Our Partners",
    title: {
        main: "Trusted by leading",
        highlight: "hotels & resorts.",
    },
    description:
        "We provide professional linen and laundry care for hotels, resorts and villas across Sri Lanka.",
    partners: [
        {
            name: "Goldi Sands Hotel",
            image: "./assets/images/partners/goldi-sands.jpg",
            description:
                "A beachfront hotel in Negombo offering comfortable rooms and direct access to the golden sands of the Indian Ocean.",
            years: 3,
            location: "Negombo",
        },
        {
            name: "Carolina Beach Resort",
            image: "./assets/images/partners/carolina-beach.jpg",
            description:
                "A tropical beach resort along the west coast, known for its serene atmosphere and warm hospitality.",
            years: 2,
            location: "Negombo",
        },
        {
            name: "Suriya Resort",
            image: "./assets/images/partners/suriya-resort.jpg",
            description:
                "A boutique resort offering a peaceful retreat with lush gardens and modern amenities.",
            years: 2,
            location: "Negombo",
        },
        {
            name: "Amagi Resort",
            image: "./assets/images/partners/amagi-resort.jpg",
            description:
                "A 4-star hotel group with properties near the Negombo Lagoon, offering panoramic views and refined accommodation.",
            years: 3,
            location: "Negombo",
        },
        {
            name: "Avenra Garden",
            image: "./assets/images/partners/avenra-garden.jpg",
            description:
                "A luxury hotel offering stylish rooms, exquisite dining, and exceptional service in the heart of Negombo.",
            years: 2,
            location: "Negombo",
        },
        {
            name: "1.2.3 Villa",
            image: "./assets/images/partners/123-villa.jpg",
            description:
                "A private villa accommodation offering a home-away-from-home experience with personalised service.",
            years: 1,
            location: "Negombo",
        },
        {
            name: "Thisara Ayurvedic Spa",
            image: "./assets/images/partners/thisara-ayurvedic.jpg",
            description:
                "A luxury villa and Ayurvedic wellness retreat offering tranquil pool-side living and holistic spa experiences.",
            years: 1,
            location: "Negombo",
        },
        {
            name: "Camelot Beach Hotel",
            image: "./assets/images/partners/camelot-hotel.jpg",
            description:
                "An upscale beachfront hotel featuring an Ayurvedic spa, beachfront pool, and multiple dining options.",
            years: 2,
            location: "Negombo",
        },
        {
            name: "Maple Leaf Hotel",
            image: "./assets/images/partners/maple-leaf.jpg",
            description:
                "A 3-star hotel near Negombo Beach offering indoor and outdoor pools, a restaurant, and comfortable rooms.",
            years: 1,
            location: "Negombo",
        },
    ],
};

// Process/How It Works Section Data
export interface ProcessStep {
    number: string;
    title: string;
    text: string;
    icon: IconType;
}

export const processSteps: ProcessStep[] = [
    {
        number: "01",
        title: "Tell us what you need",
        text: "Hotel, partner shop, or counter drop-off.",
        icon: RiCalendarCheckLine,
    },
    {
        number: "02",
        title: "We collect",
        text: "Linen from hotels, clothes from partner shops.",
        icon: RiTruckLine,
    },
    {
        number: "03",
        title: "We clean",
        text: "Washed, dried, pressed and checked.",
        icon: RiSparklingLine,
    },
    {
        number: "04",
        title: "We return",
        text: "Hotels & shops get delivery; public collects at the counter.",
        icon: RiHomeSmileLine,
    },
];

export const processSection = {
    badge: "How It Works",
    title: {
        main: "Laundry in",
        highlight: "4 easy steps.",
    },
    description: "",
    info: {
        title: "Simple. Professional. Convenient.",
        subtitle: "We take care of your clothes.",
    },
};

// Why Love Laundry Section Data
export interface Feature {
    icon: IconType;
    title: string;
    description: string;
}

export const features: Feature[] = [
    {
        icon: RiTruckLine,
        title: "Hotel & Shop Collection",
        description:
            "We collect soiled linen from hotels and partner shops, then deliver it back clean.",
    },
    {
        icon: RiSparklingLine,
        title: "Professional Care",
        description:
            "Your clothes are handled with professional equipment and care.",
    },
    {
        icon: RiTimeLine,
        title: "Save Your Time",
        description:
            "Spend your time on what matters while we take care of your laundry.",
    },
    {
        icon: RiShieldCheckLine,
        title: "Trusted Service",
        description:
            "We treat every garment with the attention and care it deserves.",
    },
];

export const benefits: string[] = [
    "Professional cleaning",
    "Careful linen handling",
    "Hotel & shop collection and return",
    "Reliable customer service",
];

export const whyLoveLaundrySection = {
    badge: "Why Love Laundry",
    title: {
        main: "More than clean.",
        highlight: "It's care.",
    },
    description:
        "Professional care plus modern convenience — for busy families, professionals and businesses.",
    card: {
        title: "We care about every garment.",
        description:
            "Professional laundry that's convenient, reliable and genuinely cared for.",
        info: {
            title: "Freshness you can trust",
            subtitle: "Every order receives professional care.",
        },
    },
};

// Testimonials Section Data
export interface Testimonial {
    quote: string;
    name: string;
    location: string;
    service: string;
}

export const testimonials: Testimonial[] = [
    {
        quote:
            "Our hotel linen has never looked better — always collected and delivered on time, always spotless.",
        name: "Nadil Fernando",
        location: "Chilaw",
        service: "Hotel Linen Service",
    },
    {
        quote:
            "I drop my shirts at the shop round the corner and collect them there. Simple and reliable.",
        name: "Dinuka Perera",
        location: "Madampe",
        service: "Shop Drop-off",
    },
    {
        quote:
            "They handled my delicate dress with such care, it looked brand new.",
        name: "Amaya Wickramasinghe",
        location: "Wennappuwa",
        service: "Dry Cleaning",
    },
];

export const testimonialsSection = {
    badge: "Testimonials",
    title: {
        main: "Loved by",
        highlight: "busy families.",
    },
    description: "Real reviews from real customers.",
};

// Contact Section Data
export const contactSection = {
    badge: {
        icon: RiSparklingLine,
        text: "Ready when you are",
    },
    title: "Need linen care or a drop-off point?",
    description:
        "Call or message us for hotel & shop collection, or to find your nearest counter. We do not deliver to homes.",
    features: [
        "Professional care",
        "Hotel & shop collection",
        "Counter hand-over & collection",
    ],
    buttons: {
        phone: {
            text: "Call Us",
            href: `tel:${companyInfo.phone}`,
        },
        whatsapp: {
            text: "WhatsApp Us",
            href: `https://wa.me/${companyInfo.whatsapp.replace(/\+/g, "")}`,
        },
    },
};

// Join With Us / Hiring Section Data
export interface JobOpening {
    title: string;
    type: string;
    description: string;
    icon: IconType;
}

export const jobOpenings: JobOpening[] = [
    {
        title: "Collection Driver",
        type: "Full-Time",
        description:
            "Collect soiled linen from hotels and partner shops, and deliver clean linen back. Valid licence required.",
        icon: RiTruckLine,
    },
    {
        title: "Machine Operator",
        type: "Full-Time",
        description:
            "Operate industrial washing and drying machines. Training provided for the right candidate.",
        icon: RiScales3Line,
    },
    {
        title: "Ironer / Presser",
        type: "Full-Time / Part-Time",
        description:
            "Press and finish garments to professional standards. Experience with commercial irons preferred.",
        icon: RiSparklingLine,
    },
    {
        title: "Collection Agent",
        type: "Part-Time",
        description:
            "Handle hand-overs at our counter and partner shops, and coordinate hotel collections.",
        icon: RiUserStarLine,
    },
];

export const hiringSection = {
    badge: "Join Our Team",
    title: {
        main: "Grow with",
        highlight: "Love Laundry.",
    },
    description:
        "We're building a team of passionate people who take pride in delivering quality. Join us and build a career you'll love.",
    perks: [
        { icon: RiMoneyRupeeCircleLine, text: "Competitive pay" },
        { icon: RiTeamLine, text: "Friendly team environment" },
        { icon: RiAwardLine, text: "Training & growth opportunities" },
        { icon: RiTimeLine, text: "Flexible schedules available" },
    ],
    cta: {
        text: "Apply via WhatsApp",
        href: `https://wa.me/${companyInfo.whatsapp.replace(/\+/g, "")}?text=${encodeURIComponent("Hi Love Laundry, I'm interested in joining your team!")}`,
    },
};
