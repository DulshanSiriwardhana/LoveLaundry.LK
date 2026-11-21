// Location data for the Love Laundry map.
// `main` is the laundry itself (public drop-off & hand-over counter).
// Other entries are partner collection points: customers hand clothes in
// there, we collect from the point, clean, and deliver back to the same point.
// `precision: "town"` means the coordinates are the town centre, not an exact
// shop/address — the UI labels these as approximate.

export interface Location {
    id: string;
    name: string;
    type: "laundry" | "shop";
    lat: number;
    lng: number;
    address: string;
    phone?: string;
    hours?: string;
    precision?: "exact" | "town";
}

export const mainLaundry: Location = {
    id: "main",
    name: "Love Laundry - Main Centre",
    type: "laundry",
    lat: 7.530726899987307,
    lng: 79.88488349451244,
    address: "Kuda Bingiriya, Panirendawa, Madagama, Chilaw",
    phone: "+94774200919",
    hours: "Mon - Sat: 8:00 AM - 6:00 PM",
    precision: "exact",
};

export const shopLocations: Location[] = [
    {
        id: "shop-madampe",
        name: "Love Laundry - Madampe",
        type: "shop",
        lat: 7.495754231527253,
        lng: 79.84219091237887,
        address: "Madampe, Puttalam District",
        precision: "exact",
    },
    {
        id: "shop-mahawewa",
        name: "Love Laundry - Mahawewa",
        type: "shop",
        lat: 7.459222497703205,
        lng: 79.82596756992497,
        address: "Mahawewa, Puttalam District",
        precision: "exact",
    },
    {
        id: "shop-kottaralumma",
        name: "Love Laundry - Kottaralumma",
        type: "shop",
        lat: 7.3799,
        lng: 79.8665,
        address: "Kottaralumma, Puttalam District",
        precision: "town",
    },
    {
        id: "shop-dunakadeniya",
        name: "Love Laundry - Dunakadeniya",
        type: "shop",
        lat: 7.4349,
        lng: 79.9372,
        address: "Dunakadeniya, Puttalam District",
        precision: "town",
    },
    {
        id: "shop-bibiladeniya",
        name: "Love Laundry - Bibiladeniya",
        type: "shop",
        lat: 7.4529,
        lng: 79.9435,
        address: "Bibiladeniya, Puttalam District",
    },
    {
        id: "shop-wennappuwa",
        name: "Love Laundry - Wennappuwa",
        type: "shop",
        lat: 7.342864473141506,
        lng: 79.84148426752375,
        address: "Wennappuwa, Puttalam District",
        precision: "exact",
    },
];

export const allLocations: Location[] = [mainLaundry, ...shopLocations];
