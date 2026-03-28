// Curated AMC theater database by market

export interface SeatTip {
  format: string;
  headline: string;
  tips: string[];
}

export interface TheaterInfo {
  slug: string;
  name: string;
  neighborhood: string;
  hasImax70mm: boolean;
  address?: string;
  googleMapsQuery?: string; // Used to build a Google Maps search link
  parkingTips?: string[];
  amenities?: string[];
  phone?: string;
  transitTips?: string[];
  seatTips?: SeatTip[];
}

export interface Market {
  slug: string;
  name: string;
  state: string;
}

export const MARKETS: Market[] = [
  { slug: "new-york-city", name: "New York City", state: "NY" },
  { slug: "los-angeles", name: "Los Angeles", state: "CA" },
  { slug: "chicago", name: "Chicago", state: "IL" },
  { slug: "san-francisco", name: "San Francisco", state: "CA" },
  { slug: "dallas-fort-worth", name: "Dallas-Fort Worth", state: "TX" },
  { slug: "boston", name: "Boston", state: "MA" },
  { slug: "washington-d-c", name: "Washington D.C.", state: "DC" },
  { slug: "philadelphia", name: "Philadelphia", state: "PA" },
  { slug: "houston", name: "Houston", state: "TX" },
  { slug: "atlanta", name: "Atlanta", state: "GA" },
  { slug: "seattle", name: "Seattle", state: "WA" },
  { slug: "miami", name: "Miami", state: "FL" },
  { slug: "phoenix", name: "Phoenix", state: "AZ" },
  { slug: "denver", name: "Denver", state: "CO" },
];

export const POPULAR_THEATERS: Record<string, TheaterInfo[]> = {
  "new-york-city": [
    {
      slug: "amc-lincoln-square-13",
      name: "AMC Lincoln Square 13",
      neighborhood: "Upper West Side",
      hasImax70mm: true,
      address: "1998 Broadway, New York, NY 10023",
      googleMapsQuery: "AMC+Lincoln+Square+13+1998+Broadway+New+York+NY",
      phone: "(212) 336-5000",
      amenities: [
        "IMAX 70mm (only in NYC)",
        "Dolby Cinema",
        "Reserved seating",
        "Full bar & lounge",
        "MacGuffins Bar",
        "Power recliner seats",
        "Dine-in options",
        "Wheelchair accessible",
      ],
      parkingTips: [
        "AMC validates parking at Lincoln Square Garage (enter on W 67th St off Broadway) — ask at box office",
        "Icon Parking at 1965 Broadway (2 min walk) — flat rate evenings/weekends",
        "Standard Parking at 150 W 68th St — often cheaper than Broadway options",
        "Street parking on W 65th–70th is metered; free after 7 PM on most blocks",
      ],
      transitTips: [
        "Subway: 1 train to 66th St–Lincoln Center (1 block away)",
        "Bus: M7, M11, M104 all stop on Broadway near 66th St",
        "Bike: Citi Bike stations at Broadway & W 67th and W 65th",
      ],
      seatTips: [
        {
          format: "IMAX 70mm",
          headline: "World's largest IMAX screen — pick your row carefully",
          tips: [
            "Sweet spot: center section, rows D–H. The steep rake puts you perfectly aligned with the screen's midpoint.",
            "Avoid rows A–C: the screen towers over 80 ft tall and those seats force you to look nearly straight up.",
            "Rows D–F give maximum immersion; rows G–J offer a slightly more relaxed, balanced perspective.",
            "Stay in the center block (roughly seats 6–14 out of ~20 per row) — the side sections lose the symmetrical audio and curved screen benefits.",
            "If comfort matters more than immersion, rows K–L are further back but recliners and the steep rake still provide a great view.",
          ],
        },
        {
          format: "Dolby Cinema",
          headline: "Dolby sweet spot: center rows, dead center",
          tips: [
            "Prime position: dead center, rows G–K. Atmos audio is calibrated to this zone and the laser image is sharpest here.",
            "Recliner seating means any row D–L is premium — tilt back and let the sound wrap around you.",
            "Avoid the very back row (row N+): overhead Atmos channels sound more diffuse the further you sit from the calibration point.",
            "Center aisle seats in rows G–K are the most sought-after — book early.",
            "Skip the far ends of any row: the curved Dolby screen creates slight geometry distortion at extreme angles.",
          ],
        },
      ],
    },
    {
      slug: "amc-empire-25",
      name: "AMC Empire 25",
      neighborhood: "Times Square",
      hasImax70mm: false,
      address: "234 W 42nd St, New York, NY 10036",
      googleMapsQuery: "AMC+Empire+25+234+W+42nd+St+New+York+NY",
      phone: "(212) 398-3939",
      amenities: [
        "25 screens",
        "IMAX",
        "Dolby Cinema",
        "Reserved seating",
        "Full bar",
        "Dine-in options",
        "Large format auditoriums",
        "Wheelchair accessible",
      ],
      parkingTips: [
        "Impark at 330 W 42nd St (1 block west) — convenient but pricey",
        "Icon Parking at 8th Ave & W 42nd St — flat rate after 5 PM",
        "Port Authority Bus Terminal has a parking garage (8th Ave & W 41st) — walk 2 min",
        "Tip: Park in Hell's Kitchen (W 43rd–48th, 9th–10th Ave) for cheaper street parking",
      ],
      transitTips: [
        "Subway: A, C, E to 42nd St–Port Authority; N, Q, R, W, S, 1, 2, 3, 7 to Times Sq–42nd St",
        "Bus: M42 crosstown, M10, M11 on 8th Ave",
        "Walking: 5 min from Penn Station",
      ],
      seatTips: [
        {
          format: "IMAX",
          headline: "Empire IMAX: go center, go mid-row",
          tips: [
            "Best seats: center block, rows E–I. The screen is large and the mid-rows keep the image at a natural angle.",
            "Avoid the front 3 rows — Empire's IMAX is tall and the close seats cause neck fatigue on long films.",
            "Stay in the center ~60% of any row; outer seats lose the surround audio sweet spot.",
            "Rows J and above are further back but more comfortable for 2+ hour films — trade some immersion for neck relief.",
          ],
        },
        {
          format: "Dolby Cinema",
          headline: "Empire Dolby: aim for the calibration zone",
          tips: [
            "Optimal zone: center section, rows H–L. This is where Atmos spatial audio is most precisely delivered.",
            "The elevated back rows (H+) naturally align your ears with the primary speaker array.",
            "Avoid front-row Dolby seats — you'll hear the subwoofer-heavy bass more than the spatial audio design.",
            "Aisle seats in rows H–K let you enjoy prime audio without sacrificing easy exit.",
          ],
        },
      ],
    },
    {
      slug: "amc-kips-bay-15",
      name: "AMC Kips Bay 15",
      neighborhood: "Kips Bay",
      hasImax70mm: false,
      address: "570 2nd Ave, New York, NY 10016",
      googleMapsQuery: "AMC+Kips+Bay+15+570+2nd+Ave+New+York+NY",
      phone: "(212) 447-0638",
      amenities: [
        "15 screens",
        "Reserved seating",
        "IMAX",
        "Snack bar",
        "One of NYC's largest multiplexes",
        "Wheelchair accessible",
      ],
      parkingTips: [
        "Kinney Parking at 555 2nd Ave (across the street) — most convenient option",
        "GMC Parking at 333 E 34th St — walk 5 min, often cheaper",
        "Street parking on 2nd Ave is metered; limited spots near the theater",
        "Tip: Arrive early — this is a busy multiplex and garage fills up on weekends",
      ],
      transitTips: [
        "Subway: 6 train to 33rd St (walk 5 blocks north) or 28th St (walk 5 blocks south)",
        "Bus: M15 and M15-SBS on 2nd Ave stop right outside; M34 crosstown",
        "Bike: Citi Bike station at 2nd Ave & E 34th St",
      ],
      seatTips: [
        {
          format: "IMAX",
          headline: "Kips Bay IMAX: standard digital, flexible seating",
          tips: [
            "Sweet spot: center section, rows D–H. The screen is large but has a gentler rake than Lincoln Square.",
            "Avoid rows A–C: too close, the viewing angle becomes uncomfortable quickly.",
            "Center seats (avoid the outer 15% of seats on either side) give the best IMAX audio imaging.",
            "This is digital IMAX — not the 70mm film format at Lincoln Square — so seating flexibility is greater and more rows are comfortable.",
            "Rows I–K are a relaxed fallback if the preferred rows are sold out.",
          ],
        },
      ],
    },
    {
      slug: "amc-34th-street-14",
      name: "AMC 34th Street 14",
      neighborhood: "Herald Square",
      hasImax70mm: false,
      address: "312 W 34th St, New York, NY 10001",
      googleMapsQuery: "AMC+34th+Street+14+312+W+34th+St+New+York+NY",
      phone: "(212) 244-4556",
      amenities: [
        "14 screens",
        "Reserved seating",
        "IMAX",
        "Snack bar",
        "Close to Penn Station",
        "Wheelchair accessible",
      ],
      parkingTips: [
        "Rapid Park at 315 W 33rd St (1 block south) — convenient for the theater",
        "Penn Station Garage (enter on W 33rd) — large, usually available",
        "Icon Parking at 400 W 33rd St — walk 3 min",
        "Tip: Plenty of garages in the 30s between 7th–9th Ave; shop around",
      ],
      transitTips: [
        "Subway: 1, 2, 3 to 34th St–Penn Station; A, C, E to 34th St–Penn Station; B, D, F, M, N, Q, R, W to 34th St–Herald Square",
        "Bus: M34, M16, M20 all serve this area",
        "LIRR / NJ Transit: Penn Station is steps away",
      ],
    },
    {
      slug: "amc-village-7",
      name: "AMC Village 7",
      neighborhood: "Greenwich Village",
      hasImax70mm: false,
      address: "66 3rd Ave, New York, NY 10003",
      googleMapsQuery: "AMC+Village+7+66+3rd+Ave+New+York+NY",
      phone: "(212) 982-2828",
      amenities: [
        "7 screens",
        "Reserved seating",
        "Cozy neighborhood multiplex",
        "Snack bar",
        "Wheelchair accessible",
      ],
      parkingTips: [
        "Parking is very limited in the Village — public transit strongly recommended",
        "Impark at 110 E 14th St (10 min walk south) is the nearest garage",
        "Street parking on side streets (E 10th, E 12th) — metered on weekdays, check signs",
        "Tip: This is one of the most transit-accessible theaters in NYC",
      ],
      transitTips: [
        "Subway: 6 to Astor Place (1 block); R, W to 8th St–NYU (2 blocks); L to 3rd Ave (2 blocks)",
        "Bus: M103 on 3rd Ave stops directly outside; M15 on 1st/2nd Ave nearby",
        "Bike: Multiple Citi Bike stations within 1 block on 3rd Ave",
      ],
    },
    {
      slug: "amc-84th-street-6",
      name: "AMC 84th Street 6",
      neighborhood: "Upper West Side",
      hasImax70mm: false,
      address: "2310 Broadway, New York, NY 10024",
      googleMapsQuery: "AMC+84th+Street+6+2310+Broadway+New+York+NY",
      phone: "(212) 721-6023",
      amenities: [
        "6 screens",
        "Reserved seating",
        "Neighborhood multiplex",
        "Snack bar",
        "Wheelchair accessible",
      ],
      parkingTips: [
        "Rapid Park at 2353 Broadway (1 block north) — most convenient",
        "Icon Parking at 201 W 83rd St (enter on W 83rd between Broadway & Amsterdam)",
        "Street parking on side streets (W 83rd–86th) — free after 7 PM on most blocks",
        "Tip: This is a neighborhood theater; most locals walk or take the subway",
      ],
      transitTips: [
        "Subway: 1 train to 86th St (1 block north) or 79th St (5 blocks south)",
        "Bus: M104 and M7 on Broadway; M86 crosstown on 86th St",
        "Bike: Citi Bike station at Broadway & W 83rd St",
      ],
    },
  ],
  "los-angeles": [
    {
      slug: "amc-century-city-15",
      name: "AMC Century City 15",
      neighborhood: "Century City",
      hasImax70mm: true,
      address: "10250 Santa Monica Blvd, Los Angeles, CA 90067",
      googleMapsQuery: "AMC+Century+City+15+10250+Santa+Monica+Blvd+Los+Angeles+CA",
      phone: "(310) 289-4262",
      amenities: ["IMAX 70mm", "Dolby Cinema", "Reserved seating", "Full bar", "Wheelchair accessible"],
      parkingTips: ["Westfield Century City mall parking — validated with ticket purchase", "Street parking limited; use mall structure"],
      transitTips: ["Bus: Big Blue Bus Line 7; Metro Rapid 720 to Century City"],
      seatTips: [
        {
          format: "IMAX 70mm",
          headline: "Century City IMAX 70mm sweet spot",
          tips: [
            "Center section, rows E–I: the raked seating puts you at eye level with the screen's midpoint.",
            "Avoid rows A–C for the same reason as any 70mm screen — it's massive and front seats strain your neck.",
            "Stay in the center block (avoid outer third of seats); side seats lose the curved projection geometry.",
          ],
        },
        {
          format: "Dolby Cinema",
          headline: "Dolby sweet spot at Century City",
          tips: [
            "Rows G–K, center block: the Atmos calibration zone and sharpest laser image overlap here.",
            "Recliner seats make most rows comfortable, but the center mid-rows are still the audio pinnacle.",
            "Avoid the very back rows — Atmos height channels lose precision beyond the design range.",
          ],
        },
      ],
    },
    {
      slug: "amc-burbank-16",
      name: "AMC Burbank 16",
      neighborhood: "Burbank",
      hasImax70mm: false,
      address: "125 E Palm Ave, Burbank, CA 91502",
      googleMapsQuery: "AMC+Burbank+16+125+E+Palm+Ave+Burbank+CA",
      phone: "(818) 953-0633",
      amenities: ["16 screens", "IMAX", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Downtown Burbank parking structures on Palm Ave — 2 hrs free with validation"],
      transitTips: ["Metrolink: Burbank Downtown station (5 min walk)", "Bus: Burbank Bus Line 2"],
    },
    {
      slug: "amc-grove-14",
      name: "AMC The Grove 14",
      neighborhood: "The Grove",
      hasImax70mm: false,
      address: "189 The Grove Dr, Los Angeles, CA 90036",
      googleMapsQuery: "AMC+The+Grove+14+189+The+Grove+Dr+Los+Angeles+CA",
      phone: "(323) 692-0829",
      amenities: ["14 screens", "Dolby Cinema", "Reserved seating", "Bar", "Wheelchair accessible"],
      parkingTips: ["The Grove parking structure — validated; first 2 hrs free on weekdays"],
      transitTips: ["Bus: Metro Rapid 780 on Fairfax"],
    },
    {
      slug: "amc-santa-monica-7",
      name: "AMC Santa Monica 7",
      neighborhood: "Santa Monica",
      hasImax70mm: false,
      address: "1310 3rd Street Promenade, Santa Monica, CA 90401",
      googleMapsQuery: "AMC+Santa+Monica+7+1310+3rd+Street+Promenade+Santa+Monica+CA",
      phone: "(310) 458-3557",
      amenities: ["7 screens", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Santa Monica Civic Center Parking (Lot 1-5) — first 90 min free", "3rd Street Promenade garages nearby"],
      transitTips: ["Big Blue Bus: Multiple lines to 3rd St Promenade", "Metro E Line (Expo) to Downtown Santa Monica"],
    },
    {
      slug: "amc-universal-citywalk-stadium-19",
      name: "AMC Universal CityWalk 19",
      neighborhood: "Universal City",
      hasImax70mm: true,
      address: "100 Universal City Plaza, Universal City, CA 91608",
      googleMapsQuery: "AMC+Universal+CityWalk+19+Universal+City+CA",
      phone: "(818) 508-0711",
      amenities: ["IMAX 70mm", "19 screens", "Dolby Cinema", "Reserved seating", "Bar", "Wheelchair accessible"],
      parkingTips: ["Universal Studios parking structure — validated with AMC ticket", "Flat rate parking evenings/weekends"],
      transitTips: ["Metro B Line (Red) to Universal City/Studio City station", "Shuttle from station to CityWalk"],
    },
  ],
  "chicago": [
    {
      slug: "amc-river-east-21",
      name: "AMC River East 21",
      neighborhood: "Streeterville",
      hasImax70mm: false,
      address: "322 E Illinois St, Chicago, IL 60611",
      googleMapsQuery: "AMC+River+East+21+322+E+Illinois+St+Chicago+IL",
      phone: "(312) 596-0333",
      amenities: ["21 screens", "IMAX", "Dolby Cinema", "Reserved seating", "Bar", "Wheelchair accessible"],
      parkingTips: ["River East Garage (attached to theater) — validated with ticket", "Street parking on Illinois/Grand Ave"],
      transitTips: ["Red/Brown Line to Grand (10 min walk east)", "Bus: 29 State St, 65 Grand Ave"],
    },
    {
      slug: "amc-navy-pier-imax",
      name: "AMC Navy Pier IMAX",
      neighborhood: "Navy Pier",
      hasImax70mm: true,
      address: "700 E Grand Ave, Chicago, IL 60611",
      googleMapsQuery: "AMC+Navy+Pier+IMAX+700+E+Grand+Ave+Chicago+IL",
      phone: "(312) 595-0090",
      amenities: ["IMAX 70mm", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Navy Pier Parking Garage (enter from Illinois St) — validated", "Surface lots along Grand Ave"],
      transitTips: ["Bus: 29 State to Navy Pier; free water taxi from Michigan Ave", "Walkable from Streeterville hotels"],
      seatTips: [
        {
          format: "IMAX 70mm",
          headline: "Navy Pier IMAX 70mm: one of Chicago's best screens",
          tips: [
            "Center section, rows D–H: optimal alignment with the full 70mm frame.",
            "The theater has a steeper rake than most — this means even row D is at a comfortable angle.",
            "Avoid front 2 rows: the screen's height makes them uncomfortable for long films.",
            "Center block seats (middle ~50% of the row) capture the full surround sound design.",
          ],
        },
      ],
    },
    {
      slug: "amc-block-37",
      name: "AMC Block 37",
      neighborhood: "Loop",
      hasImax70mm: false,
      address: "108 N State St, Chicago, IL 60602",
      googleMapsQuery: "AMC+Block+37+108+N+State+St+Chicago+IL",
      phone: "(312) 263-7672",
      amenities: ["6 screens", "Reserved seating", "IMAX", "Wheelchair accessible"],
      parkingTips: ["Multiple garages in the Loop — 55 W Monroe, 65 E Lake St", "CTA-accessible; parking expensive downtown"],
      transitTips: ["All CTA lines to State/Lake or Washington/Wabash", "Bus: multiple routes on State St"],
    },
    {
      slug: "amc-streets-of-woodfield-20",
      name: "AMC Streets of Woodfield 20",
      neighborhood: "Schaumburg",
      hasImax70mm: false,
      address: "601 N Martingale Rd, Schaumburg, IL 60173",
      googleMapsQuery: "AMC+Streets+of+Woodfield+20+601+N+Martingale+Rd+Schaumburg+IL",
      phone: "(847) 330-4343",
      amenities: ["20 screens", "IMAX", "Dolby Cinema", "Reserved seating", "Bar", "Wheelchair accessible"],
      parkingTips: [
        "Free surface parking in Woodfield area lots — very ample",
        "Dedicated AMC lot on Martingale Rd — never fills except holiday blockbusters",
      ],
      transitTips: [
        "Metra: North Central Service to Schaumburg station (10 min drive/rideshare)",
        "Pace Bus: Routes 554, 606 to Woodfield area",
        "Car is the most practical option from Chicago — 45 min via I-90",
      ],
      seatTips: [
        {
          format: "Dolby Cinema",
          headline: "Streets of Woodfield Dolby: suburban gem with great audio",
          tips: [
            "Center section, rows G–K: the Atmos sweet spot in this auditorium is well-calibrated.",
            "Recliner seats throughout — center mid-rows book first for premium releases.",
            "Avoid the very back 2 rows where overhead Atmos channels lose precision.",
          ],
        },
      ],
    },
    {
      slug: "amc-crestwood-18",
      name: "AMC Crestwood 18",
      neighborhood: "Crestwood",
      hasImax70mm: false,
      address: "13221 Rivercrest Dr, Crestwood, IL 60418",
      googleMapsQuery: "AMC+Crestwood+18+13221+Rivercrest+Dr+Crestwood+IL",
      phone: "(708) 388-0063",
      amenities: ["18 screens", "IMAX", "Reserved seating", "Wheelchair accessible"],
      parkingTips: [
        "Free surface parking lot — very ample, never fills",
        "Adjacent to Crestwood Court mall for combined trips",
      ],
      transitTips: [
        "Car is primary; south suburbs location ~25 min from downtown Chicago via I-294",
        "Pace Bus Route 352 serves Rivercrest Dr area",
      ],
    },
  ],
  "san-francisco": [
    {
      slug: "amc-metreon-16",
      name: "AMC Metreon 16",
      neighborhood: "SoMa",
      hasImax70mm: true,
      address: "135 4th St, San Francisco, CA 94103",
      googleMapsQuery: "AMC+Metreon+16+135+4th+St+San+Francisco+CA",
      phone: "(415) 369-6207",
      amenities: ["IMAX 70mm", "16 screens", "Dolby Cinema", "Reserved seating", "Bar", "Wheelchair accessible"],
      parkingTips: ["5th & Mission Garage (1 block) — AMC validation available", "Yerba Buena Garage on 3rd St"],
      transitTips: ["BART: Powell St or Montgomery (both 5-10 min walk)", "Muni: Multiple lines on Market St"],
      seatTips: [
        {
          format: "IMAX 70mm",
          headline: "Metreon IMAX 70mm: SF's premier large-format screen",
          tips: [
            "Sweet spot: center section, rows E–I. The IMAX 70mm auditorium has a good rake that makes center mid-rows excellent.",
            "Avoid the front 3 rows — the screen's height makes these seats uncomfortable for full-length films.",
            "Center block (avoid seats at the extreme ends) for the best audio and optical geometry.",
          ],
        },
        {
          format: "Dolby Cinema",
          headline: "Dolby at Metreon: world-class sound",
          tips: [
            "Rows G–K center: the Atmos sweet spot where all speaker layers converge most precisely.",
            "The Metreon Dolby auditorium is known for excellent bass management — center rows avoid any bass node buildup.",
            "Recliner seats throughout, but center mid-rows book fastest — reserve early.",
          ],
        },
      ],
    },
    {
      slug: "amc-kabuki-8",
      name: "AMC Kabuki 8",
      neighborhood: "Japantown",
      hasImax70mm: false,
      address: "1881 Post St, San Francisco, CA 94115",
      googleMapsQuery: "AMC+Kabuki+8+1881+Post+St+San+Francisco+CA",
      phone: "(415) 346-3243",
      amenities: ["8 screens", "Reserved seating", "Bar", "In-theater dining", "Wheelchair accessible"],
      parkingTips: ["Japan Center Garage (directly connected) — AMC validation available", "Street parking on Post/Geary"],
      transitTips: ["Bus: 38 Geary, 22 Fillmore", "Bike: Bay Wheels station at Fillmore & Post"],
    },
    {
      slug: "amc-dine-in-bay-street-16",
      name: "AMC Dine-In Bay Street 16",
      neighborhood: "Emeryville",
      hasImax70mm: false,
      address: "5614 Bay St, Emeryville, CA 94608",
      googleMapsQuery: "AMC+Dine-In+Bay+Street+16+5614+Bay+St+Emeryville+CA",
      phone: "(510) 547-3456",
      amenities: ["16 screens", "IMAX", "Dolby Cinema", "Dine-in options", "Full bar", "Reserved seating", "Power recliner seats", "Wheelchair accessible"],
      parkingTips: [
        "Bay Street shopping center parking — free 3 hrs with AMC validation",
        "Large structured garage off Bay St — plenty of spaces even on weekends",
      ],
      transitTips: [
        "BART: MacArthur station (2 min Uber/Lyft) or Emery-Go-Round shuttle from MacArthur",
        "AC Transit: Lines 72/72R on San Pablo Ave (5 min walk)",
        "Easy access from I-80 or I-580 — ample parking makes driving viable",
      ],
      seatTips: [
        {
          format: "Dolby Cinema",
          headline: "Bay Street Dolby: East Bay's best large-format screen",
          tips: [
            "Center section, rows H–L: Atmos audio is calibrated for this zone in the plush recliner seating.",
            "Dine-in option in Dolby — order before the film for best timing; trays don't obstruct sightlines from mid-row.",
            "Avoid front 3 rows: too close for the large Dolby screen even with recliners tilted back.",
          ],
        },
      ],
    },
    {
      slug: "amc-mercado-20",
      name: "AMC Mercado 20",
      neighborhood: "Santa Clara",
      hasImax70mm: false,
      address: "3111 Mission College Blvd, Santa Clara, CA 95054",
      googleMapsQuery: "AMC+Mercado+20+3111+Mission+College+Blvd+Santa+Clara+CA",
      phone: "(408) 988-7880",
      amenities: ["20 screens", "IMAX", "Reserved seating", "Wheelchair accessible"],
      parkingTips: [
        "Free surface parking lot at Mercado shopping center — very ample",
        "Adjacent to Great America Pkwy — easy access from US-101 or CA-237",
      ],
      transitTips: [
        "VTA Light Rail: Great America station (10 min walk)",
        "Bus: VTA Route 60 Mission College Blvd",
        "Car is primary from SF — 45 min via US-101 South",
      ],
    },
  ],
  "dallas-fort-worth": [
    {
      slug: "amc-northpark-15",
      name: "AMC NorthPark 15",
      neighborhood: "NorthPark",
      hasImax70mm: true,
      address: "8687 N Central Expy, Dallas, TX 75225",
      googleMapsQuery: "AMC+NorthPark+15+8687+N+Central+Expy+Dallas+TX",
      amenities: ["IMAX 70mm", "15 screens", "Dolby Cinema", "Reserved seating", "Bar", "Wheelchair accessible"],
      parkingTips: ["NorthPark Center mall parking — free, ample spaces", "Covered parking on north and south ends of mall"],
      transitTips: ["DART: NorthPark Center station (Red/Blue/Green/Orange Line)"],
    },
    {
      slug: "amc-grapevine-mills-30",
      name: "AMC Grapevine Mills 30",
      neighborhood: "Grapevine",
      hasImax70mm: false,
      address: "3150 Grapevine Mills Pkwy, Grapevine, TX 76051",
      googleMapsQuery: "AMC+Grapevine+Mills+30+3150+Grapevine+Mills+Pkwy+Grapevine+TX",
      amenities: ["30 screens", "IMAX", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Free parking in Grapevine Mills mall lots — very ample"],
      transitTips: ["Car is primary option; close to DFW Airport"],
    },
  ],
  "boston": [
    {
      slug: "amc-boston-common-19",
      name: "AMC Boston Common 19",
      neighborhood: "Downtown Boston",
      hasImax70mm: true,
      address: "175 Tremont St, Boston, MA 02111",
      googleMapsQuery: "AMC+Boston+Common+19+175+Tremont+St+Boston+MA",
      phone: "(617) 423-5801",
      amenities: ["IMAX 70mm", "19 screens", "Dolby Cinema", "Reserved seating", "Bar", "Wheelchair accessible"],
      parkingTips: [
        "Boston Common Garage (enter on Charles St) — AMC validated rate with purchase",
        "Government Center Garage on New Sudbury St — 5 min walk",
        "Tip: Transit is strongly recommended — downtown parking is expensive on weekends",
      ],
      transitTips: [
        "Green Line: Boylston station (1 block from theater)",
        "Red/Orange Line: Downtown Crossing (5 min walk via Winter St)",
        "Commuter Rail: South Station (10 min walk via Tremont St)",
      ],
      seatTips: [
        {
          format: "IMAX 70mm",
          headline: "Boston Common IMAX 70mm: New England's best large-format screen",
          tips: [
            "Center section, rows E–I: the steep rake aligns your sightline perfectly with the screen's midpoint.",
            "Avoid the front 3 rows — this 70mm screen is very tall and front seats force uncomfortable neck angles.",
            "Stay in the center block (avoid outer ~30% of seats); the curved screen loses geometry at extreme angles.",
            "Rows J–L are further back but still excellent with recliner seats; good fallback if prime rows are sold out.",
          ],
        },
        {
          format: "Dolby Cinema",
          headline: "Boston Common Dolby: Atmos calibrated for this room",
          tips: [
            "Rows G–K, center section: the primary Atmos listening zone — all speaker layers converge here.",
            "Recliner seats throughout; center aisle seats in rows H–J book first for premium releases.",
            "Skip rows A–C: the Dolby screen is large and bass-heavy speaker placement makes front rows overwhelming.",
          ],
        },
      ],
    },
    {
      slug: "amc-assembly-row-12",
      name: "AMC Assembly Row 12",
      neighborhood: "Somerville",
      hasImax70mm: false,
      address: "395 Artisan Way, Somerville, MA 02145",
      googleMapsQuery: "AMC+Assembly+Row+12+395+Artisan+Way+Somerville+MA",
      phone: "(617) 628-7000",
      amenities: ["12 screens", "Reserved seating", "Bar", "Wheelchair accessible"],
      parkingTips: ["Assembly Row parking garage — 2 hrs free with validation", "Surface lots on Artisan Way"],
      transitTips: ["Orange Line: Assembly station (directly connected)", "Bus: 90, 95 to Assembly Square"],
    },
    {
      slug: "amc-framingham-16",
      name: "AMC Framingham 16",
      neighborhood: "Framingham",
      hasImax70mm: false,
      address: "19 Providence Rd, Framingham, MA 01702",
      googleMapsQuery: "AMC+Framingham+16+19+Providence+Rd+Framingham+MA",
      phone: "(508) 872-0011",
      amenities: ["16 screens", "IMAX", "Reserved seating", "Wheelchair accessible"],
      parkingTips: [
        "Free surface parking at Shoppers World mall — very ample, never an issue",
        "Dedicated AMC section near theater entrance on south side",
      ],
      transitTips: [
        "Commuter Rail: Framingham/Worcester Line to Framingham station (10 min drive/rideshare)",
        "MWRTA Bus: Routes 2, 7 serve the Shoppers World area",
        "Car is primary from Boston — 30 min via Mass Pike (I-90) West",
      ],
    },
    {
      slug: "amc-south-bay-center-12",
      name: "AMC South Bay Center 12",
      neighborhood: "Dorchester",
      hasImax70mm: false,
      address: "2 Allstate Rd, Dorchester, MA 02125",
      googleMapsQuery: "AMC+South+Bay+Center+12+2+Allstate+Rd+Dorchester+MA",
      phone: "(617) 265-4905",
      amenities: ["12 screens", "IMAX", "Dolby Cinema", "Reserved seating", "Wheelchair accessible"],
      parkingTips: [
        "South Bay Center parking lot — free, ample surface parking",
        "Tip: One of the more affordable AMC parking situations in Greater Boston",
      ],
      transitTips: [
        "Red Line: JFK/UMass station (10 min walk via Old Colony Ave)",
        "Bus: Routes 8, 10, 16 serve the South Bay shopping area",
        "Easy access from I-93 South — Exit 15 for South Bay Center",
      ],
    },
  ],
  "washington-d-c": [
    {
      slug: "amc-georgetown-14",
      name: "AMC Georgetown 14",
      neighborhood: "Georgetown",
      hasImax70mm: false,
      address: "3111 K St NW, Washington, DC 20007",
      googleMapsQuery: "AMC+Georgetown+14+3111+K+St+NW+Washington+DC",
      phone: "(202) 342-6033",
      amenities: ["14 screens", "Reserved seating", "Bar", "Wheelchair accessible"],
      parkingTips: [
        "Georgetown Park garage on K St — validated with AMC ticket",
        "Street parking on M St and side streets (metered, often scarce on weekends)",
        "Tip: Transit or rideshare strongly recommended — Georgetown parking is expensive and competitive",
      ],
      transitTips: [
        "Bus: D1, D2, D6 from Dupont Circle or Foggy Bottom Metro (Blue/Orange/Silver Line)",
        "DC Circulator: Georgetown-Union Station route stops at K & Wisconsin",
        "Bike: Capital Bikeshare stations at 34th & Water St and M & 33rd St NW",
      ],
    },
    {
      slug: "amc-tysons-corner-16",
      name: "AMC Tysons Corner 16",
      neighborhood: "Tysons Corner",
      hasImax70mm: true,
      address: "7850 Walker Dr, Tysons Corner, VA 22102",
      googleMapsQuery: "AMC+Tysons+Corner+16+7850+Walker+Dr+Tysons+Corner+VA",
      phone: "(703) 448-4488",
      amenities: ["IMAX 70mm", "16 screens", "Dolby Cinema", "Reserved seating", "Wheelchair accessible"],
      parkingTips: [
        "Tysons Corner Center mall parking — free, very ample structured garages",
        "Multiple garage entrances off Walker Dr and International Dr",
      ],
      transitTips: [
        "Silver Line: Tysons Corner station (10–15 min walk via enclosed skywalk from Macy's)",
        "Bus: Fairfax Connector routes 401, 402, 424 stop at Tysons Corner Center",
      ],
      seatTips: [
        {
          format: "IMAX 70mm",
          headline: "Tysons Corner IMAX 70mm: DC area's premier 70mm screen",
          tips: [
            "Center section, rows E–I: the rake is good and these seats align you with the screen's midpoint.",
            "Avoid rows A–C: the 70mm screen is very tall and front seats cause neck strain on long films.",
            "Center block (middle ~60% of each row) for the best audio imaging and projection geometry.",
            "Tysons is the DC area's only IMAX 70mm — book early, especially for opening weekend.",
          ],
        },
        {
          format: "Dolby Cinema",
          headline: "Tysons Dolby: suburb Atmos done right",
          tips: [
            "Rows G–K center: the Atmos calibration zone — all overhead and surround speakers converge precisely here.",
            "Recliner seats make most rows comfortable, but center mid-rows book first for big releases.",
            "The Dolby auditorium at Tysons is well-sized — even row L still delivers solid spatial audio.",
          ],
        },
      ],
    },
    {
      slug: "amc-hoffman-center-22",
      name: "AMC Hoffman Center 22",
      neighborhood: "Alexandria",
      hasImax70mm: false,
      address: "206 Swamp Fox Rd, Alexandria, VA 22314",
      googleMapsQuery: "AMC+Hoffman+Center+22+206+Swamp+Fox+Rd+Alexandria+VA",
      phone: "(703) 997-8700",
      amenities: ["22 screens", "IMAX", "Dolby Cinema", "Reserved seating", "Bar", "Wheelchair accessible"],
      parkingTips: [
        "Eisenhower Town Center parking garage — validated with AMC ticket",
        "Surface lots around Hoffman Center — free on evenings and weekends",
      ],
      transitTips: [
        "Yellow/Blue Line: Eisenhower Avenue Metro station (10 min walk or 3 min shuttle)",
        "Bus: DASH Route AT-2 and WMATA routes serve Eisenhower Ave",
        "Easy access from I-95/495 — take Exit 173B for Eisenhower Ave",
      ],
      seatTips: [
        {
          format: "Dolby Cinema",
          headline: "Hoffman Center Dolby: one of Northern Virginia's best",
          tips: [
            "Center section, rows H–L: excellent Atmos calibration in this auditorium.",
            "Recliner seats throughout; center mid-rows book up fast for high-demand releases.",
            "The auditorium is well-sized — even rows M–N deliver solid spatial audio from recliners.",
          ],
        },
      ],
    },
    {
      slug: "amc-mazza-gallerie-7",
      name: "AMC Mazza Gallerie 7",
      neighborhood: "Friendship Heights",
      hasImax70mm: false,
      address: "5300 Wisconsin Ave NW, Washington, DC 20015",
      googleMapsQuery: "AMC+Mazza+Gallerie+7+5300+Wisconsin+Ave+NW+Washington+DC",
      phone: "(202) 966-6000",
      amenities: ["7 screens", "Reserved seating", "Wheelchair accessible"],
      parkingTips: [
        "Mazza Gallerie parking garage — validated with AMC ticket",
        "Street parking on Wisconsin Ave (metered) or residential streets off Friendship Heights",
      ],
      transitTips: [
        "Red Line: Friendship Heights station (directly connected via underground walkway)",
        "Bus: 31, 32, 36 on Wisconsin Ave; L2 on Nebraska Ave",
        "Bike: Capital Bikeshare station at Wisconsin & Jenifer St NW",
      ],
    },
  ],
  "philadelphia": [
    {
      slug: "amc-cherry-hill-24",
      name: "AMC Cherry Hill 24",
      neighborhood: "Cherry Hill",
      hasImax70mm: false,
      address: "2000 NJ-38, Cherry Hill, NJ 08002",
      googleMapsQuery: "AMC+Cherry+Hill+24+2000+NJ-38+Cherry+Hill+NJ",
      amenities: ["24 screens", "IMAX", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Cherry Hill Mall parking — free, ample", "Dedicated theater lot off NJ-38"],
      transitTips: ["Car primary; NJ Transit Bus 313 from Philadelphia"],
    },
    {
      slug: "amc-neshaminy-24",
      name: "AMC Neshaminy 24",
      neighborhood: "Bensalem",
      hasImax70mm: false,
      address: "3900 Rockhill Dr, Bensalem, PA 19020",
      googleMapsQuery: "AMC+Neshaminy+24+3900+Rockhill+Dr+Bensalem+PA",
      amenities: ["24 screens", "IMAX", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Neshaminy Mall parking — free, very ample"],
      transitTips: ["Car primary; SEPTA Bus 14 from Philadelphia"],
    },
  ],
  "houston": [
    {
      slug: "amc-gulf-pointe-30",
      name: "AMC Gulf Pointe 30",
      neighborhood: "South Houston",
      hasImax70mm: true,
      address: "11801 S Sam Houston Pkwy E, Houston, TX 77089",
      googleMapsQuery: "AMC+Gulf+Pointe+30+Houston+TX",
      amenities: ["IMAX 70mm", "30 screens", "Dolby Cinema", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Free parking lot — very ample", "Dedicated AMC section in front of theater"],
      transitTips: ["Car primary in this area"],
    },
    {
      slug: "amc-studio-30",
      name: "AMC Studio 30",
      neighborhood: "Dunvale",
      hasImax70mm: false,
      address: "2949 Dunvale Rd, Houston, TX 77063",
      googleMapsQuery: "AMC+Studio+30+2949+Dunvale+Rd+Houston+TX",
      amenities: ["30 screens", "IMAX", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Free surface parking lot — large"],
      transitTips: ["Car primary; METRO Bus 82 Westheimer stops nearby"],
    },
  ],
  "atlanta": [
    {
      slug: "amc-phipps-plaza-14",
      name: "AMC Phipps Plaza 14",
      neighborhood: "Buckhead",
      hasImax70mm: false,
      address: "3500 Peachtree Rd NE, Atlanta, GA 30326",
      googleMapsQuery: "AMC+Phipps+Plaza+14+3500+Peachtree+Rd+NE+Atlanta+GA",
      amenities: ["14 screens", "IMAX", "Reserved seating", "Bar", "Wheelchair accessible"],
      parkingTips: ["Phipps Plaza mall parking — validated", "Free garage with AMC ticket"],
      transitTips: ["MARTA: Lenox station (10 min walk)", "Bus: MARTA Route 110"],
    },
    {
      slug: "amc-southlake-24",
      name: "AMC Southlake 24",
      neighborhood: "Morrow",
      hasImax70mm: false,
      address: "1000 Southlake Mall, Morrow, GA 30260",
      googleMapsQuery: "AMC+Southlake+24+1000+Southlake+Mall+Morrow+GA",
      amenities: ["24 screens", "IMAX", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Southlake Mall parking — free"],
      transitTips: ["MARTA: Southlake Mall stop on Bus 193"],
    },
  ],
  "seattle": [
    {
      slug: "amc-pacific-place-11",
      name: "AMC Pacific Place 11",
      neighborhood: "Downtown",
      hasImax70mm: false,
      address: "600 Pine St, Seattle, WA 98101",
      googleMapsQuery: "AMC+Pacific+Place+11+600+Pine+St+Seattle+WA",
      amenities: ["11 screens", "IMAX", "Reserved seating", "Bar", "Wheelchair accessible"],
      parkingTips: ["Pacific Place Garage (connected to mall) — validated", "Westlake Center garage on 4th Ave"],
      transitTips: ["Link Light Rail: Westlake station (1 block)", "Bus: Multiple routes on Pine/Pike"],
    },
    {
      slug: "amc-seattle-10",
      name: "AMC Seattle 10",
      neighborhood: "Downtown",
      hasImax70mm: false,
      address: "2100 4th Ave, Seattle, WA 98121",
      googleMapsQuery: "AMC+Seattle+10+2100+4th+Ave+Seattle+WA",
      amenities: ["10 screens", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Numerous paid garages on 2nd–5th Ave in Belltown", "Street parking available on 4th Ave (metered)"],
      transitTips: ["Monorail to Seattle Center; Bus: Multiple routes on 3rd/4th Ave"],
    },
  ],
  "miami": [
    {
      slug: "amc-aventura-24",
      name: "AMC Aventura 24",
      neighborhood: "Aventura",
      hasImax70mm: true,
      address: "19501 Biscayne Blvd, Aventura, FL 33180",
      googleMapsQuery: "AMC+Aventura+24+19501+Biscayne+Blvd+Aventura+FL",
      amenities: ["IMAX 70mm", "24 screens", "Dolby Cinema", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Aventura Mall parking — free, very ample", "Dedicated AMC zone near theater entrance"],
      transitTips: ["Broward County Transit Bus 1 on Biscayne Blvd; Tri-Rail Aventura station (shuttle available)"],
    },
    {
      slug: "amc-sunset-place-24",
      name: "AMC Sunset Place 24",
      neighborhood: "South Miami",
      hasImax70mm: false,
      address: "5701 Sunset Dr, South Miami, FL 33143",
      googleMapsQuery: "AMC+Sunset+Place+24+5701+Sunset+Dr+South+Miami+FL",
      amenities: ["24 screens", "IMAX", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Sunset Place garage — validated with AMC ticket", "Street parking on Sunset Dr (metered)"],
      transitTips: ["Metrorail: South Miami station (5 min walk)", "Bus: Route 57"],
    },
  ],
  "phoenix": [
    {
      slug: "amc-arizona-center-24",
      name: "AMC Arizona Center 24",
      neighborhood: "Downtown",
      hasImax70mm: false,
      address: "455 N 3rd St, Phoenix, AZ 85004",
      googleMapsQuery: "AMC+Arizona+Center+24+455+N+3rd+St+Phoenix+AZ",
      amenities: ["24 screens", "IMAX", "Reserved seating", "Wheelchair accessible"],
      parkingTips: ["Arizona Center parking garage (attached) — validated", "Van Buren St garages nearby"],
      transitTips: ["Valley Metro Light Rail: 3rd St/Jefferson station (3 min walk)", "Bus: Multiple downtown routes"],
    },
    {
      slug: "amc-esplanade-14",
      name: "AMC Esplanade 14",
      neighborhood: "Phoenix",
      hasImax70mm: false,
      address: "2515 E Camelback Rd, Phoenix, AZ 85016",
      googleMapsQuery: "AMC+Esplanade+14+2515+E+Camelback+Rd+Phoenix+AZ",
      amenities: ["14 screens", "IMAX", "Reserved seating"],
      parkingTips: ["Esplanade parking structure — validated", "Street parking on Camelback Rd"],
      transitTips: ["Bus: Valley Metro Route 50 on Camelback"],
    },
  ],
  "denver": [
    {
      slug: "amc-flatiron-crossing-14",
      name: "AMC Flatiron Crossing 14",
      neighborhood: "Broomfield",
      hasImax70mm: false,
      address: "1 W Flatiron Crossing Dr, Broomfield, CO 80021",
      googleMapsQuery: "AMC+Flatiron+Crossing+14+Broomfield+CO",
      amenities: ["14 screens", "IMAX", "Reserved seating"],
      parkingTips: ["Flatiron Crossing mall parking — free, very ample"],
      transitTips: ["RTD Bus: Flatiron Flyer FF1 or FF2 from Denver to Broomfield"],
    },
    {
      slug: "amc-westminster-promenade-24",
      name: "AMC Westminster 24",
      neighborhood: "Westminster",
      hasImax70mm: false,
      address: "10655 Westminster Blvd, Westminster, CO 80020",
      googleMapsQuery: "AMC+Westminster+Promenade+24+Westminster+CO",
      amenities: ["24 screens", "IMAX", "Reserved seating"],
      parkingTips: ["Westminster Promenade surface lot — free"],
      transitTips: ["RTD Bus: Route FF1 Westminster station"],
    },
  ],
};

/** Search theaters across all markets by name query */
export function searchTheaters(query: string, marketSlug?: string): TheaterInfo[] {
  const q = query.toLowerCase();
  const markets = marketSlug ? [marketSlug] : Object.keys(POPULAR_THEATERS);

  const results: TheaterInfo[] = [];
  for (const market of markets) {
    const theaters = POPULAR_THEATERS[market];
    if (!theaters) continue;
    for (const t of theaters) {
      if (
        t.name.toLowerCase().includes(q) ||
        t.slug.includes(q) ||
        t.neighborhood.toLowerCase().includes(q)
      ) {
        results.push(t);
      }
    }
  }
  return results;
}

/** Get market slug for a theater */
export function getMarketForTheater(theaterSlug: string): string | null {
  for (const [market, theaters] of Object.entries(POPULAR_THEATERS)) {
    if (theaters.some((t) => t.slug === theaterSlug)) return market;
  }
  return null;
}

/** Look up a theater by slug across all markets */
export function getTheaterBySlug(theaterSlug: string): TheaterInfo | null {
  for (const theaters of Object.values(POPULAR_THEATERS)) {
    const found = theaters.find((t) => t.slug === theaterSlug);
    if (found) return found;
  }
  return null;
}

export interface AmenityBadge {
  icon: string;
  label: string;
  /** CSS color for the badge text/border */
  color: string;
  /** CSS background for the badge */
  bg: string;
}

/** Map an amenity string to an icon + color badge. Falls back to a neutral style. */
export function getAmenityBadge(amenity: string): AmenityBadge {
  const a = amenity.toLowerCase();

  if (a.includes("imax 70mm"))
    return { icon: "🎬", label: amenity, color: "#8888ff", bg: "#1a1a2e" };
  if (a.includes("dolby"))
    return { icon: "🔊", label: amenity, color: "#66aaff", bg: "#0f1a2e" };
  if (a.includes("imax"))
    return { icon: "📽", label: amenity, color: "#aaaaff", bg: "#1a1a2e" };

  if (a.includes("recliner"))
    return { icon: "🪑", label: amenity, color: "#55cc88", bg: "#0e2018" };
  if (a.includes("reserved seating") || a.includes("reserved"))
    return { icon: "🎫", label: amenity, color: "#88ccaa", bg: "#0e1e16" };

  if (a.includes("full bar") || (a.includes("bar") && !a.includes("candy")))
    return { icon: "🍺", label: amenity, color: "#ffbb44", bg: "#2a1e00" };
  if (a.includes("dine-in") || a.includes("dine in") || a.includes("dining"))
    return { icon: "🍽", label: amenity, color: "#ff9955", bg: "#2a1200" };
  if (a.includes("food ordering") || a.includes("food"))
    return { icon: "🍿", label: amenity, color: "#ffcc66", bg: "#221a00" };
  if (a.includes("macguffin") || a.includes("lounge"))
    return { icon: "🍸", label: amenity, color: "#ffbb44", bg: "#2a1e00" };

  if (a.includes("wheelchair") || a.includes("ada") || a.includes("accessible"))
    return { icon: "♿", label: amenity, color: "#38bdf8", bg: "#0c1a24" };

  // Default
  return { icon: "✓", label: amenity, color: "var(--text-secondary)", bg: "var(--bg-base)" };
}
