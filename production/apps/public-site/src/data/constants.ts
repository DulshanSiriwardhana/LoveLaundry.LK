export const COMPANY = {
    name: "Love Laundry",
    tagline: "Trusted hotel linen care.",
    description: "Hotel Linen & Laundry Service",

    phone: "0774200919",
    phoneFull: "+94774200919",
    whatsapp: "0774200919",
    whatsappFull: "+94774200919",
    email: "lovelaundry01@gmail.com",

    address: {
        full: "Love Laundry, Kuda Bingiriya, Panirendawa, Madagama, Chilaw",
        street: "Kuda Bingiriya",
        area: "Panirendawa",
        town: "Madagama",
        city: "Chilaw",
        district: "Puttalam",
        country: "Sri Lanka",
    },

    location: {
        lat: 7.5783,
        lng: 79.8367,
    },

    hours: {
        display: "Mon - Sat",
        open: "8:00 AM - 6:00 PM",
        subtitle: "Counter hours",
    },

    stats: {
        rating: "4.9",
        serviceCount: "10+",
        availability: "Mon - Sat",
        customerCount: "200+",
        experience: "3+",
    },

    social: {
        facebook: "https://www.facebook.com/profile.php?id=61593342239310",
        instagram: "",
        tiktok: "",
    },

    serviceAreas: [
        "Chilaw",
        "Madampe",
        "Mahawewa",
        "Wennappuwa",
        "Negombo",
    ] as const,

    googleMapsUrl: "https://www.google.com/maps/search/Love+Laundry+Madagama+Chilaw",

    whatsappLink: "https://wa.me/94774200919",
    whatsappMessage:
        "Hi Love Laundry, I'd like to know about your hotel linen service or my nearest drop-off point.",
    whatsappCareersMessage: "Hi Love Laundry, I'm interested in joining your team!",
} as const;

export const NAV_ITEMS = [
    { id: "home", label: "Home" },
    { id: "services", label: "Services" },
    { id: "commercial", label: "Commercial" },
    { id: "process", label: "How It Works" },
    { id: "about", label: "Why Us" },
    { id: "partners", label: "Partners" },
    { id: "hiring", label: "Careers" },
    { id: "contact", label: "Contact" },
] as const;
