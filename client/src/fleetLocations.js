/** Common FleetProxy country codes (username uses -country-XX). */
export const FLEET_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "IE", name: "Ireland" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "PH", name: "Philippines" },
  { code: "MY", name: "Malaysia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "TR", name: "Turkey" },
  { code: "IL", name: "Israel" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "NG", name: "Nigeria" },
  { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" },
  { code: "CZ", name: "Czechia" },
  { code: "RO", name: "Romania" },
  { code: "HU", name: "Hungary" },
  { code: "NZ", name: "New Zealand" },
];

/**
 * Local catalog of FleetProxy-style slugs (lowercase, no spaces).
 * FleetProxy does not publish a public API for these generator lists,
 * so we keep a curated copy (especially US) and allow custom slug typing.
 */
export const FLEET_REGIONS_BY_COUNTRY = {
  US: [
    { state: "Alabama", cities: ["Birmingham", "Montgomery", "Huntsville", "Mobile", "Tuscaloosa", "Hoover", "Dothan", "Auburn", "Decatur", "Madison", "Florence", "Gadsden", "Vestavia Hills", "Prattville", "Phenix City", "Alabaster", "Bessemer", "Enterprise", "Homewood", "Athens", "Northport", "Anniston", "Daphne", "Pelham", "Trussville", "Albertville", "Oxford", "Mountain Brook", "Fairhope", "Helena", "Calera", "Troy", "Selma", "Talladega", "Jasper", "Opelika", "Foley", "Gulf Shores", "Cullman", "Scottsboro", "Fort Payne", "Eufaula", "Tuskegee", "Demopolis", "Brewton", "Andalusia", "Monroeville", "Greenville", "Oneonta", "Roanoke"] },
    { state: "Alaska", cities: ["Anchorage", "Fairbanks", "Juneau", "Sitka", "Ketchikan", "Wasilla", "Kenai", "Kodiak", "Bethel", "Palmer", "Homer", "Soldotna", "Valdez", "Seward", "Cordova", "Nome", "Kotzebue", "Utqiaġvik", "Dillingham", "Unalaska", "Petersburg", "Wrangell", "Haines", "Skagway", "Craig", "Thorne Bay", "Metlakatla", "Galena", "McGrath", "Tok", "Delta Junction", "Glennallen", "North Pole", "Eagle River", "Chugiak", "Nikiski", "Sterling", "Willow", "Houston", "Sutton", "Hoonah", "Angoon", "Tenakee Springs", "Pelican", "Kake", "Hydaburg", "Klawock", "Sand Point", "King Cove", "Cold Bay"] },
    { state: "Arizona", cities: ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale", "Glendale", "Gilbert", "Tempe", "Peoria", "Surprise", "Yuma", "Avondale", "Goodyear", "Flagstaff", "Buckeye", "Casa Grande", "Sierra Vista", "Maricopa", "Oro Valley", "Prescott", "Prescott Valley", "Bullhead City", "Apache Junction", "Queen Creek", "Lake Havasu City", "El Mirage", "Fountain Hills", "Nogales", "Douglas", "Eloy", "Florence", "Coolidge", "Payson", "Sedona", "Cottonwood", "Camp Verde", "Chino Valley", "Kingman", "Winslow", "Holbrook", "Page", "Globe", "Safford", "Thatcher", "Bisbee", "Tombstone", "Willcox", "Benson", "Wickenburg", "Paradise Valley"] },
    { state: "Arkansas", cities: ["Little Rock", "Fort Smith", "Fayetteville", "Springdale", "Jonesboro", "North Little Rock", "Conway", "Rogers", "Hot Springs", "Bentonville", "Benton", "Jacksonville", "West Memphis", "Bella Vista", "Cabot", "Sherwood", "Texarkana", "Russellville", "Van Buren", "Pine Bluff", "Bryant", "Maumelle", "El Dorado", "Siloam Springs", "Marion", "Harrison", "Mountain Home", "Paragould", "Searcy", "Camden", "Magnolia", "Arkadelphia", "Hope", "Monticello", "Stuttgart", "Newport", "Batesville", "Wynne", "Beebe", "Trumann", "Osceola", "Blytheville", "Greenwood", "Clarksville", "Berryville", "Warren", "Pocahontas", "Mena", "Malvern", "Heber Springs"] },
    { state: "California", cities: ["Los Angeles", "San Diego", "San Jose", "San Francisco", "Fresno", "Sacramento", "Long Beach", "Oakland", "Bakersfield", "Anaheim", "Santa Ana", "Riverside", "Stockton", "Irvine", "Chula Vista", "Fremont", "San Bernardino", "Modesto", "Oxnard", "Fontana", "Moreno Valley", "Huntington Beach", "Glendale", "Santa Clarita", "Garden Grove", "Oceanside", "Rancho Cucamonga", "Santa Rosa", "Ontario", "Elk Grove", "Corona", "Lancaster", "Palmdale", "Salinas", "Hayward", "Pomona", "Escondido", "Sunnyvale", "Torrance", "Pasadena", "Orange", "Fullerton", "Thousand Oaks", "Visalia", "Simi Valley", "Concord", "Roseville", "Santa Clara", "Vallejo", "Berkeley"] },
    { state: "Colorado", cities: ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood", "Thornton", "Arvada", "Westminster", "Pueblo", "Centennial", "Boulder", "Greeley", "Longmont", "Loveland", "Grand Junction", "Broomfield", "Castle Rock", "Commerce City", "Parker", "Littleton", "Northglenn", "Brighton", "Wheat Ridge", "Englewood", "Fountain", "Golden", "Louisville", "Lafayette", "Erie", "Windsor", "Johnstown", "Greenwood Village", "Lone Tree", "Highlands Ranch", "Castle Pines", "Steamboat Springs", "Durango", "Montrose", "Glenwood Springs", "Aspen", "Vail", "Breckenridge", "Telluride", "Cañon City", "Trinidad", "Alamosa", "Gunnison", "Fort Morgan", "Sterling", "Rifle"] },
    { state: "Connecticut", cities: ["Bridgeport", "New Haven", "Stamford", "Hartford", "Waterbury", "Norwalk", "Danbury", "New Britain", "Meriden", "Bristol", "Milford", "Shelton", "Torrington", "Middletown", "Norwich", "Ansonia", "Derby", "Naugatuck", "New London", "West Haven", "Willimantic", "Groton", "Manchester", "Enfield", "Vernon", "Windsor", "Wethersfield", "Newington", "Glastonbury", "Southington", "Wallingford", "Cheshire", "Branford", "Guilford", "Madison", "Old Saybrook", "Clinton", "Mystic", "Stonington", "Putnam", "Danielson", "Killingly", "Windham", "Plainfield", "Coventry", "Storrs", "Tolland", "Somers", "Suffield", "Avon"] },
    { state: "Delaware", cities: ["Wilmington", "Dover", "Newark", "Middletown", "Smyrna", "Milford", "Bear", "Glasgow", "Brookside", "Hockessin", "New Castle", "Pike Creek", "Claymont", "Elsmere", "Delaware City", "Harrington", "Lewes", "Rehoboth Beach", "Seaford", "Georgetown", "Millsboro", "Milton", "Selbyville", "Ocean View", "Bethany Beach", "Fenwick Island", "Dagsboro", "Frankford", "Laurel", "Bridgeville", "Greenwood", "Blades", "Delmar", "Townsend", "Clayton", "Camden", "Wyoming", "Felton", "Magnolia", "Viola", "Woodside", "Little Creek", "Bowers Beach", "Frederica", "South Bethany", "Dewey Beach", "Newport", "Christiana", "Stanton", "Newport"] },
    { state: "Florida", cities: ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg", "Hialeah", "Tallahassee", "Fort Lauderdale", "Port St. Lucie", "Cape Coral", "Pembroke Pines", "Hollywood", "Gainesville", "Miramar", "Coral Springs", "Palm Coast", "Lehigh Acres", "Clearwater", "Palm Bay", "Lakeland", "Pompano Beach", "Davie", "Miami Gardens", "Boca Raton", "Sunrise", "Deltona", "Plantation", "Fort Myers", "Daytona Beach", "Largo", "Melbourne", "Ocala", "Sarasota", "Boynton Beach", "Kissimmee", "Pensacola", "Sanford", "North Port", "Palm Beach Gardens", "Wellington", "Jupiter", "Bonita Springs", "Apopka", "Altamonte Springs", "Weston", "DeLand", "Fort Walton Beach", "Panama City", "Key West", "Naples"] },
    { state: "Georgia", cities: ["Atlanta", "Columbus", "Augusta", "Macon", "Savannah", "Athens", "Sandy Springs", "Roswell", "Johns Creek", "Albany", "Warner Robins", "Alpharetta", "Marietta", "Valdosta", "Smyrna", "Dunwoody", "Brookhaven", "Peachtree Corners", "Mableton", "Stonecrest", "Newnan", "Peachtree City", "Gainesville", "East Point", "Rome", "Dalton", "Douglasville", "Hinesville", "Kennesaw", "Statesboro", "Lawrenceville", "Tucker", "Duluth", "Stockbridge", "Carrollton", "LaGrange", "Woodstock", "Redan", "Thomasville", "McDonough", "Acworth", "Union City", "Cartersville", "Villa Rica", "Americus", "Milledgeville", "Griffin", "Brunswick", "Tifton", "Bainbridge"] },
    { state: "Hawaii", cities: ["Honolulu", "Hilo", "Kailua", "Kaneohe", "Waipahu", "Pearl City", "Mililani", "Kahului", "Ewa Beach", "Waimalu", "Kapolei", "Wailuku", "Kihei", "Lahaina", "Kailua-Kona", "Captain Cook", "Hawaiian Paradise Park", "Aiea", "Wahiawa", "Schofield Barracks", "Makakilo", "Waianae", "Nanakuli", "Haleiwa", "Laie", "Kahuku", "Waimanalo", "Hawaii Kai", "Kahala", "Palolo", "Manoa", "Nuuanu", "Liliha", "Kalihi", "Salt Lake", "Moanalua", "Aiea Heights", "Halawa", "Waipio", "Royal Kunia", "Village Park", "Ocean Pointe", "Ewa Villages", "Kalaeloa", "Makaha", "Waialua", "Hauula", "Punaluu", "Hauula", "Laie"] },
    { state: "Idaho", cities: ["Boise", "Meridian", "Nampa", "Idaho Falls", "Caldwell", "Pocatello", "Coeur d'Alene", "Twin Falls", "Rexburg", "Post Falls", "Lewiston", "Eagle", "Moscow", "Kuna", "Ammon", "Mountain Home", "Chubbuck", "Hayden", "Jerome", "Blackfoot", "Garden City", "Burley", "Star", "Middleton", "Rathdrum", "Hailey", "Sandpoint", "Payette", "Emmett", "Rupert", "Fruitland", "Weiser", "Preston", "Rigby", "Shelley", "Kimberly", "American Falls", "Buhl", "Gooding", "Heyburn", "McCall", "St. Anthony", "Ketchum", "Grangeville", "Orofino", "Soda Springs", "Salmon", "Wendell", "Homedale", "Filer"] },
    { state: "Illinois", cities: ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford", "Springfield", "Elgin", "Peoria", "Champaign", "Waukegan", "Cicero", "Bloomington", "Arlington Heights", "Evanston", "Decatur", "Schaumburg", "Bolingbrook", "Palatine", "Skokie", "Des Plaines", "Orland Park", "Tinley Park", "Oak Lawn", "Berwyn", "Mount Prospect", "Normal", "Wheaton", "Hoffman Estates", "Oak Park", "Downers Grove", "Glenview", "Elmhurst", "DeKalb", "Romeoville", "Crystal Lake", "Plainfield", "Buffalo Grove", "Carol Stream", "Quincy", "Rock Island", "Moline", "East St. Louis", "Belleville", "Carbondale", "Edwardsville", "Alton", "Granite City", "Danville", "Kankakee", "Freeport"] },
    { state: "Indiana", cities: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel", "Fishers", "Bloomington", "Hammond", "Gary", "Lafayette", "Muncie", "Noblesville", "Terre Haute", "Kokomo", "Anderson", "Elkhart", "Mishawaka", "Greenwood", "Jeffersonville", "Columbus", "Lawrence", "Westfield", "Portage", "New Albany", "Merrillville", "Valparaiso", "Goshen", "Crown Point", "Michigan City", "Richmond", "Schererville", "Logansport", "Marion", "Hobart", "Jasper", "Shelbyville", "Avon", "Zionsville", "West Lafayette", "Highland", "Munster", "Frankfort", "Clarksville", "Plainfield", "Brownsburg", "Bedford", "Seymour", "Connersville", "Auburn", "Wabash"] },
    { state: "Iowa", cities: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City", "Waterloo", "Council Bluffs", "Ames", "West Des Moines", "Dubuque", "Ankeny", "Urbandale", "Cedar Falls", "Bettendorf", "Marion", "Marshalltown", "Mason City", "Ottumwa", "Fort Dodge", "Clinton", "Burlington", "Muscatine", "Coralville", "Johnston", "North Liberty", "Altoona", "Waukee", "Spencer", "Storm Lake", "Pella", "Newton", "Indianola", "Oskaloosa", "Boone", "Norwalk", "Grimes", "Creston", "Clear Lake", "Carroll", "Denison", "Atlantic", "Fairfield", "Knoxville", "Le Mars", "Missouri Valley", "Chariton", "Centerville", "Osceola", "Washington", "DeWitt"] },
    { state: "Kansas", cities: ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka", "Lawrence", "Shawnee", "Lenexa", "Manhattan", "Salina", "Hutchinson", "Leavenworth", "Leawood", "Garden City", "Dodge City", "Derby", "Gardner", "Emporia", "Prairie Village", "Junction City", "Hays", "Pittsburg", "Liberal", "Newton", "Andover", "Great Bend", "McPherson", "Ottawa", "El Dorado", "Arkansas City", "Winfield", "Merriam", "Haysville", "Lansing", "Atchison", "Spring Hill", "Bel Aire", "Mission", "Parsons", "Park City", "Augusta", "Coffeyville", "Chanute", "Independence", "Basehor", "Bonner Springs", "Fort Scott", "Wellington", "Valley Center", "Maize"] },
    { state: "Kentucky", cities: ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington", "Richmond", "Georgetown", "Florence", "Hopkinsville", "Nicholasville", "Elizabethtown", "Independence", "Radcliff", "Jeffersontown", "Frankfort", "Paducah", "Henderson", "Murray", "Erlanger", "Winchester", "Madisonville", "St. Matthews", "Danville", "Fort Thomas", "Ashland", "Middlesboro", "Alexandria", "Burlington", "Glasgow", "Shelbyville", "Bardstown", "Berea", "Newport", "Mount Washington", "Lyndon", "Somerset", "Lawrenceburg", "Maysville", "London", "Hazard", "Morehead", "Pikeville", "Corbin", "Williamsburg", "Campbellsville", "Russellville", "Mayfield", "Prestonsburg", "Harlan", "Franklin"] },
    { state: "Louisiana", cities: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles", "Kenner", "Bossier City", "Monroe", "Alexandria", "Houma", "New Iberia", "Slidell", "Prairieville", "Laplace", "Marrero", "Metairie", "Chalmette", "Bayou Cane", "Opelousas", "Zachary", "Mandeville", "Sulphur", "Natchitoches", "Gretna", "Thibodaux", "Morgan City", "Gonzales", "Harvey", "Estelle", "Timberlane", "Terrytown", "Woodmere", "Ruston", "Hammond", "Baker", "Crowley", "Minden", "Bogalusa", "DeRidder", "Jennings", "Eunice", "Denham Springs", "Bastrop", "Franklin", "West Monroe", "Port Allen", "Pineville", "Rayne", "St. Martinville", "Abbeville"] },
    { state: "Maine", cities: ["Portland", "Lewiston", "Bangor", "South Portland", "Auburn", "Biddeford", "Sanford", "Westbrook", "Saco", "Augusta", "Waterville", "Brewer", "Presque Isle", "Bath", "Ellsworth", "Old Town", "Caribou", "Belfast", "Rockland", "Gardiner", "Calais", "Hallowell", "Eastport", "Brunswick", "Scarborough", "Falmouth", "Windham", "Gorham", "Kennebunk", "York", "Orono", "Hampden", "Camden", "Bar Harbor", "Wiscasset", "Skowhegan", "Farmington", "Rumford", "Norway", "Paris", "Lincoln", "Millinocket", "Houlton", "Fort Kent", "Madawaska", "Van Buren", "Dover-Foxcroft", "Pittsfield", "Newport", "Rockport"] },
    { state: "Maryland", cities: ["Baltimore", "Frederick", "Rockville", "Gaithersburg", "Bowie", "Hagerstown", "Annapolis", "College Park", "Salisbury", "Towson", "Waldorf", "Glen Burnie", "Ellicott City", "Dundalk", "Silver Spring", "Bethesda", "Wheaton", "Germantown", "Potomac", "Aspen Hill", "North Bethesda", "Upper Marlboro", "Columbia", "Laurel", "Greenbelt", "Hyattsville", "Beltsville", "Lanham", "Oxon Hill", "Clinton", "Suitland", "Temple Hills", "Fort Washington", "Crofton", "Odenton", "Pasadena", "Catonsville", "Parkville", "Carney", "Essex", "Middle River", "Randallstown", "Owings Mills", "Pikesville", "Reisterstown", "Cockeysville", "Hunt Valley", "Westminster", "Cumberland", "Havre de Grace"] },
    { state: "Massachusetts", cities: ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell", "Brockton", "Quincy", "Lynn", "New Bedford", "Fall River", "Lawrence", "Newton", "Somerville", "Framingham", "Haverhill", "Malden", "Waltham", "Brookline", "Revere", "Plymouth", "Medford", "Taunton", "Weymouth", "Chicopee", "Peabody", "Methuen", "Everett", "Barnstable", "Attleboro", "Arlington", "Salem", "Pittsfield", "Leominster", "Beverly", "Billerica", "Fitchburg", "Marlborough", "Woburn", "Westfield", "Chelsea", "Amherst", "Braintree", "Shrewsbury", "Holyoke", "Andover", "Natick", "Watertown", "Randolph", "Franklin", "Lexington"] },
    { state: "Michigan", cities: ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Ann Arbor", "Lansing", "Clinton Township", "Flint", "Dearborn", "Livonia", "Westland", "Troy", "Farmington Hills", "Kalamazoo", "Shelby Township", "Wyoming", "Southfield", "Rochester Hills", "Taylor", "Pontiac", "St. Clair Shores", "Royal Oak", "Novi", "Dearborn Heights", "Battle Creek", "Saginaw", "Kentwood", "East Lansing", "Redford", "Portage", "Midland", "Muskegon", "Traverse City", "Bay City", "Jackson", "Holland", "Port Huron", "Roseville", "Eastpointe", "Lincoln Park", "Madison Heights", "Oak Park", "Birmingham", "Rochester", "Ypsilanti", "Grand Haven", "Marquette", "Adrian", "Monroe", "Mount Pleasant"] },
    { state: "Minnesota", cities: ["Minneapolis", "St. Paul", "Rochester", "Bloomington", "Duluth", "Brooklyn Park", "Woodbury", "Lakeville", "Plymouth", "Blaine", "Maple Grove", "St. Cloud", "Eagan", "Burnsville", "Coon Rapids", "Eden Prairie", "Apple Valley", "Edina", "Minnetonka", "St. Louis Park", "Shakopee", "Moorhead", "Mankato", "Cottage Grove", "Maplewood", "Inver Grove Heights", "Richfield", "Roseville", "Andover", "Savage", "Rosemount", "Brooklyn Center", "Fridley", "Oakdale", "Chaska", "Ramsey", "Prior Lake", "Elk River", "Shoreview", "Austin", "Owatonna", "Winona", "Chanhassen", "Farmington", "Faribault", "Otsego", "White Bear Lake", "Lino Lakes", "Champlin", "Hastings"] },
    { state: "Mississippi", cities: ["Jackson", "Gulfport", "Southaven", "Hattiesburg", "Biloxi", "Tupelo", "Olive Branch", "Meridian", "Greenville", "Clinton", "Horn Lake", "Pearl", "Madison", "Starkville", "Columbus", "Vicksburg", "Pascagoula", "Brandon", "Oxford", "Laurel", "Gautier", "Ocean Springs", "Clarksdale", "Cleveland", "Ridgeland", "McComb", "Long Beach", "Corinth", "Greenwood", "Natchez", "Moss Point", "Bay St. Louis", "Canton", "Grenada", "Brookhaven", "Petal", "Indianola", "Forest", "Holly Springs", "New Albany", "Pontotoc", "Winona", "Yazoo City", "Louisville", "Waveland", "Pass Christian", "Newton", "Philadelphia", "Kosciusko", "Amory"] },
    { state: "Missouri", cities: ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence", "Lee's Summit", "O'Fallon", "St. Charles", "St. Joseph", "Blue Springs", "St. Peters", "Joplin", "Florissant", "Wentzville", "Chesterfield", "Jefferson City", "Cape Girardeau", "Wildwood", "University City", "Liberty", "Ballwin", "Kirkwood", "Raytown", "Maryland Heights", "Gladstone", "Grandview", "Raymore", "Nixa", "Belton", "Hazelwood", "Ozark", "Webster Groves", "Sedalia", "Republic", "Arnold", "Rolla", "Warrensburg", "Farmington", "Lake St. Louis", "Creve Coeur", "Manchester", "Ferguson", "Kirksville", "Clayton", "Grain Valley", "Hannibal", "Poplar Bluff", "Jackson", "Sikeston", "Washington"] },
    { state: "Montana", cities: ["Billings", "Missoula", "Great Falls", "Bozeman", "Butte", "Helena", "Kalispell", "Havre", "Anaconda", "Belgrade", "Livingston", "Laurel", "Whitefish", "Lewistown", "Sidney", "Glendive", "Miles City", "Hamilton", "Polson", "Dillon", "Deer Lodge", "Glasgow", "Columbia Falls", "Ronan", "Shelby", "Cut Bank", "Conrad", "Choteau", "Fort Benton", "Three Forks", "Boulder", "Townsend", "East Helena", "Red Lodge", "Hardin", "Baker", "Malta", "Roundup", "Forsyth", "Harlowton", "Big Timber", "Columbus", "Absarokee", "Ennis", "Virginia City", "Twin Bridges", "Philipsburg", "Superior", "Thompson Falls", "Libby"] },
    { state: "Nebraska", cities: ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney", "Fremont", "Norfolk", "Columbus", "Papillion", "Hastings", "North Platte", "La Vista", "Scottsbluff", "South Sioux City", "Beatrice", "Lexington", "Gretna", "Gering", "York", "Blair", "Alliance", "Seward", "Crete", "Nebraska City", "McCook", "Plattsmouth", "Schuyler", "Sidney", "Ralston", "Wayne", "Holdrege", "Wahoo", "Chadron", "Aurora", "Ogallala", "Waverly", "Falls City", "Cozad", "Fairbury", "Hickman", "O'Neill", "Broken Bow", "Auburn", "Ashland", "Gothenburg", "Valley", "West Point", "Central City", "Minden", "David City"] },
    { state: "Nevada", cities: ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks", "Carson City", "Fernley", "Elko", "Mesquite", "Boulder City", "Fallon", "Winnemucca", "West Wendover", "Ely", "Yerington", "Lovelock", "Caliente", "Wells", "Carlin", "Battle Mountain", "Dayton", "Silver Springs", "Gardnerville", "Minden", "Gardnerville Ranchos", "Incline Village", "Stateline", "Zephyr Cove", "Pahrump", "Summerlin South", "Spring Valley", "Enterprise", "Paradise", "Winchester", "Whitney", "Sunrise Manor", "Laughlin", "Primm", "Jackpot", "Hawthorne", "Tonopah", "Pioche", "Panaca", "Alamo", "Rachel", "Baker", "Round Mountain", "Goldfield", "Austin", "Eureka"] },
    { state: "New Hampshire", cities: ["Manchester", "Nashua", "Concord", "Derry", "Dover", "Rochester", "Salem", "Merrimack", "Londonderry", "Hudson", "Bedford", "Keene", "Portsmouth", "Goffstown", "Laconia", "Hampton", "Milford", "Exeter", "Windham", "Durham", "Hooksett", "Lebanon", "Pelham", "Claremont", "Hanover", "Somersworth", "Amherst", "Raymond", "Conway", "Newmarket", "Berlin", "Barrington", "Weare", "Hampstead", "Franklin", "Litchfield", "Seabrook", "Hollis", "Bow", "Plaistow", "Gilford", "Stratham", "Belmont", "Swanzey", "Pembroke", "Epping", "Atkinson", "Farmington", "Plymouth", "Meredith"] },
    { state: "New Jersey", cities: ["Newark", "Jersey City", "Paterson", "Elizabeth", "Lakewood", "Edison", "Woodbridge", "Toms River", "Hamilton", "Trenton", "Clifton", "Cherry Hill", "Brick", "Camden", "Bayonne", "Passaic", "East Orange", "Union City", "Franklin Township", "Middletown", "Old Bridge", "Gloucester Township", "North Bergen", "Irvington", "Piscataway", "Vineland", "Hoboken", "Union", "Jackson", "Parsippany-Troy Hills", "Perth Amboy", "New Brunswick", "Wayne", "Plainfield", "Howell", "Bloomfield", "West New York", "East Brunswick", "West Orange", "Washington Township", "Monroe Township", "Egg Harbor Township", "South Brunswick", "Evesham", "Hackensack", "Bridgewater", "Sayreville", "Manchester Township", "Mount Laurel", "North Brunswick"] },
    { state: "New Mexico", cities: ["Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe", "Roswell", "Farmington", "Clovis", "Hobbs", "Alamogordo", "Carlsbad", "Gallup", "Deming", "Los Lunas", "Chaparral", "Sunland Park", "Las Vegas", "Portales", "Los Alamos", "Artesia", "Lovington", "Silver City", "Bernalillo", "Corrales", "Raton", "Grants", "Anthony", "Española", "Socorro", "Truth or Consequences", "Tucumcari", "Ruidoso", "Bloomfield", "Aztec", "Belen", "Milan", "Bayard", "Eunice", "Jal", "Texico", "Santa Rosa", "Moriarty", "Taos", "Taos Pueblo", "Red River", "Angel Fire", "Chama", "Cuba", "Carrizozo", "Tularosa", "Cloudcroft"] },
    { state: "New York", cities: ["New York City", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany", "New Rochelle", "Mount Vernon", "Schenectady", "Utica", "White Plains", "Troy", "Niagara Falls", "Binghamton", "Rome", "Ithaca", "Poughkeepsie", "Watertown", "Elmira", "Spring Valley", "Saratoga Springs", "Kingston", "Newburgh", "Middletown", "Jamestown", "Glens Falls", "Auburn", "Ossining", "Peekskill", "Amsterdam", "Cortland", "Oswego", "Cohoes", "Lockport", "Plattsburgh", "Dunkirk", "Geneva", "Oneonta", "Ogdensburg", "Fulton", "Canandaigua", "Gloversville", "Johnstown", "Hudson", "Rensselaer", "Tonawanda", "Long Beach", "Rye", "Corning", "Hornell"] },
    { state: "North Carolina", cities: ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville", "Cary", "Wilmington", "High Point", "Concord", "Greenville", "Asheville", "Gastonia", "Jacksonville", "Apex", "Chapel Hill", "Kannapolis", "Burlington", "Rocky Mount", "Huntersville", "Wilson", "Hickory", "Mooresville", "Indian Trail", "Monroe", "Salisbury", "Goldsboro", "New Bern", "Sanford", "Statesville", "Asheboro", "Thomasville", "Matthews", "Kernersville", "Garner", "Wake Forest", "Holly Springs", "Shelby", "Mebane", "Lexington", "Graham", "Kinston", "Elizabeth City", "Mount Holly", "Lumberton", "Lenoir", "Morganton", "Albemarle", "Havelock", "Belmont"] },
    { state: "North Dakota", cities: ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo", "Williston", "Dickinson", "Mandan", "Jamestown", "Wahpeton", "Devils Lake", "Horace", "Valley City", "Watford City", "Lincoln", "Grafton", "Beulah", "New Town", "Casselton", "Rugby", "Hazen", "Tioga", "Lisbon", "Stanley", "Bottineau", "Carrington", "Langdon", "Mayville", "Oakes", "Hillsboro", "Harvey", "Mapleton", "Surrey", "Garrison", "Park River", "Larimore", "Bowman", "Burlington", "New Rockford", "Washburn", "Cavalier", "Rolla", "Ellendale", "Hettinger", "Thompson", "New Salem", "Cando", "Velva", "Kindred", "Linton"] },
    { state: "Ohio", cities: ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton", "Parma", "Canton", "Youngstown", "Lorain", "Hamilton", "Springfield", "Kettering", "Elyria", "Lakewood", "Cuyahoga Falls", "Middletown", "Newark", "Mansfield", "Mentor", "Beavercreek", "Strongsville", "Dublin", "Fairfield", "Findlay", "Warren", "Lancaster", "Lima", "Huber Heights", "Westerville", "Reynoldsburg", "Grove City", "Marion", "Gahanna", "Brunswick", "Mason", "Stow", "West Chester", "North Olmsted", "Boardman", "Austintown", "Delaware", "Upper Arlington", "Massillon", "Garfield Heights", "Fairborn", "Riverside", "Hilliard", "Willowick", "Wooster"] },
    { state: "Oklahoma", cities: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Edmond", "Lawton", "Moore", "Midwest City", "Enid", "Stillwater", "Owasso", "Bartlesville", "Muskogee", "Shawnee", "Bixby", "Jenks", "Yukon", "Ardmore", "Ponca City", "Mustang", "Sapulpa", "Duncan", "Del City", "Durant", "Claremore", "Bethany", "Sand Springs", "El Reno", "Altus", "McAlester", "Tahlequah", "Chickasha", "Ada", "Newcastle", "Glenpool", "Miami", "Guymon", "Choctaw", "Weatherford", "Woodward", "Guthrie", "Elk City", "Okmulgee", "Coweta", "Warr Acres", "Blanchard", "Collinsville", "Pryor Creek", "The Village", "Poteau"] },
    { state: "Oregon", cities: ["Portland", "Eugene", "Salem", "Gresham", "Hillsboro", "Beaverton", "Bend", "Medford", "Springfield", "Corvallis", "Albany", "Tigard", "Lake Oswego", "Keizer", "Grants Pass", "Oregon City", "McMinnville", "Redmond", "Tualatin", "West Linn", "Woodburn", "Newberg", "Roseburg", "Forest Grove", "Milwaukie", "Happy Valley", "Wilsonville", "Klamath Falls", "Ashland", "Sherwood", "Hermiston", "Central Point", "Canby", "Dallas", "Pendleton", "The Dalles", "Coos Bay", "St. Helens", "Troutdale", "La Grande", "Monmouth", "Ontario", "Prineville", "Cottage Grove", "Sweet Home", "Silverton", "Independence", "Astoria", "North Bend", "Newport"] },
    { state: "Pennsylvania", cities: ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton", "Bethlehem", "Lancaster", "Harrisburg", "York", "Altoona", "State College", "Wilkes-Barre", "Chester", "Williamsport", "Easton", "Lebanon", "Hazleton", "New Castle", "Johnstown", "Pottstown", "Chambersburg", "Carlisle", "Bethel Park", "Norristown", "Monroeville", "Murrysville", "Penn Hills", "Plum", "Mount Lebanon", "Upper Darby", "Lower Merion", "Abington", "Bensalem", "Bristol", "Levittown", "King of Prussia", "Radnor", "Haverford", "Cheltenham", "Phoenixville", "West Chester", "Coatesville", "Downingtown", "Lansdale", "Doylestown", "Quakertown", "Pottsville", "Butler", "Indiana"] },
    { state: "Rhode Island", cities: ["Providence", "Warwick", "Cranston", "Pawtucket", "East Providence", "Woonsocket", "Newport", "Central Falls", "Westerly", "Coventry", "Cumberland", "North Providence", "South Kingstown", "West Warwick", "Johnston", "North Kingstown", "Lincoln", "Smithfield", "Bristol", "Barrington", "Burrillville", "Narragansett", "Tiverton", "East Greenwich", "Portsmouth", "Middletown", "Hopkinton", "Charlestown", "Exeter", "Richmond", "Glocester", "Scituate", "Foster", "Little Compton", "Jamestown", "New Shoreham", "Warren", "North Smithfield", "Exeter", "West Greenwich", "Foster", "Scituate", "Glocester", "Little Compton", "New Shoreham", "Jamestown", "Portsmouth", "Tiverton", "Bristol", "Warren"] },
    { state: "South Carolina", cities: ["Columbia", "Charleston", "North Charleston", "Mount Pleasant", "Rock Hill", "Greenville", "Summerville", "Sumter", "Goose Creek", "Hilton Head Island", "Florence", "Spartanburg", "Aiken", "Myrtle Beach", "Anderson", "Greer", "Mauldin", "Greenwood", "North Augusta", "Taylors", "Wade Hampton", "St. Andrews", "Seven Oaks", "Lexington", "Bluffton", "Fort Mill", "Clemson", "Simpsonville", "Easley", "Irmo", "Hanahan", "Red Hill", "Socastee", "Powdersville", "Berea", "Gantt", "Parker", "Welcome", "Laurel Bay", "Newberry", "Camden", "Lancaster", "York", "Union", "Bennettsville", "Marion", "Hartsville", "Darlington", "Dillon", "Georgetown"] },
    { state: "South Dakota", cities: ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown", "Mitchell", "Yankton", "Pierre", "Huron", "Spearfish", "Box Elder", "Vermillion", "Brandon", "Harrisburg", "Tea", "Sturgis", "Madison", "Belle Fourche", "Dell Rapids", "Hot Springs", "Hartford", "Milbank", "Mobridge", "Lead", "North Sioux City", "Summerset", "Canton", "Winner", "Lennox", "Volga", "Chamberlain", "Sisseton", "Flandreau", "Fort Pierre", "Redfield", "Beresford", "Elk Point", "Springfield", "Custer", "Webster", "Parkston", "Wagner", "Crooks", "Deadwood", "Salem", "Parker", "Baltic", "Groton", "Miller", "Freeman"] },
    { state: "Tennessee", cities: ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville", "Murfreesboro", "Franklin", "Jackson", "Johnson City", "Bartlett", "Hendersonville", "Kingsport", "Collierville", "Smyrna", "Cleveland", "Spring Hill", "Germantown", "Brentwood", "Gallatin", "Columbia", "La Vergne", "Lebanon", "Mount Juliet", "Cookeville", "Oak Ridge", "Morristown", "Maryville", "Bristol", "Farragut", "Sevierville", "Tullahoma", "Dyersburg", "East Ridge", "Greeneville", "Goodlettsville", "Dickson", "Manchester", "McMinnville", "Elizabethton", "Atoka", "Union City", "Lenoir City", "Athens", "Millington", "Shelbyville", "Springfield", "Lewisburg", "Covington", "Martin", "Lawrenceburg"] },
    { state: "Texas", cities: ["Houston", "San Antonio", "Dallas", "Fort Worth", "Austin", "El Paso", "Arlington", "Corpus Christi", "Plano", "Lubbock", "Laredo", "Irving", "Garland", "Frisco", "McKinney", "Grand Prairie", "Amarillo", "Brownsville", "Denton", "Killeen", "Mesquite", "McAllen", "Pasadena", "Waco", "Midland", "Round Rock", "Lewisville", "Carrollton", "Abilene", "Pearland", "College Station", "Odessa", "New Braunfels", "League City", "Conroe", "Richardson", "Tyler", "Allen", "Beaumont", "Edinburg", "Sugar Land", "Georgetown", "Wichita Falls", "San Angelo", "Temple", "Bryan", "Leander", "Mission", "Baytown", "Mansfield"] },
    { state: "Utah", cities: ["Salt Lake City", "West Valley City", "Provo", "West Jordan", "Orem", "Sandy", "Ogden", "St. George", "Layton", "South Jordan", "Lehi", "Murray", "Millcreek", "Taylorsville", "Cottonwood Heights", "Midvale", "Draper", "Bountiful", "Riverton", "Roy", "Spanish Fork", "Pleasant Grove", "Springville", "Kaysville", "Logan", "Clearfield", "Holladay", "Herriman", "American Fork", "Syracuse", "Eagle Mountain", "Kearns", "South Salt Lake", "Farmington", "Clinton", "North Salt Lake", "North Ogden", "Highland", "Centerville", "Magna", "Washington", "Brigham City", "South Ogden", "Bluffdale", "Woods Cross", "Santa Clara", "Grantsville", "Hurricane", "Lindon", "Mapleton"] },
    { state: "Vermont", cities: ["Burlington", "South Burlington", "Rutland", "Essex Junction", "Barre", "Montpelier", "Winooski", "St. Albans", "Newport", "Vergennes", "Colchester", "Bennington", "Brattleboro", "Essex", "Milton", "Hartford", "Williston", "Middlebury", "Springfield", "Shelburne", "St. Johnsbury", "Swanton", "Northfield", "Lyndon", "Morristown", "Waterbury", "Stowe", "Jericho", "Fairfax", "Georgia", "Rockingham", "Randolph", "Hinesburg", "Derby", "Manchester", "Castleton", "Richmond", "Brandon", "Cambridge", "Charlotte", "Bristol", "Norwich", "Shaftsbury", "Windsor", "Williamstown", "Johnson", "Highgate", "Hartland", "Pownal", "Underhill"] },
    { state: "Virginia", cities: ["Virginia Beach", "Norfolk", "Chesapeake", "Richmond", "Newport News", "Alexandria", "Hampton", "Roanoke", "Portsmouth", "Suffolk", "Lynchburg", "Harrisonburg", "Charlottesville", "Danville", "Manassas", "Petersburg", "Fredericksburg", "Winchester", "Salem", "Staunton", "Fairfax", "Hopewell", "Waynesboro", "Colonial Heights", "Radford", "Bristol", "Williamsburg", "Falls Church", "Martinsville", "Poquoson", "Vienna", "Reston", "Arlington", "McLean", "Annandale", "Springfield", "Burke", "Centreville", "Chantilly", "Herndon", "Ashburn", "Leesburg", "Sterling", "Dale City", "Woodbridge", "Lake Ridge", "Tysons", "Baileys Crossroads", "Lorton", "Fair Oaks"] },
    { state: "Washington", cities: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Kent", "Everett", "Renton", "Federal Way", "Spokane Valley", "Yakima", "Bellingham", "Auburn", "Kennewick", "Lakewood", "Redmond", "Marysville", "Pasco", "Sammamish", "Shoreline", "Burien", "Olympia", "Lacey", "Kirkland", "Bothell", "Edmonds", "Puyallup", "Lynnwood", "Issaquah", "Richland", "Bremerton", "University Place", "Wenatchee", "Mount Vernon", "Walla Walla", "Pullman", "Longview", "Centralia", "Anacortes", "Monroe", "Arlington", "Ellensburg", "Moses Lake", "Oak Harbor", "Mukilteo", "Mountlake Terrace", "Mill Creek", "Port Angeles", "Aberdeen", "Tumwater"] },
    { state: "West Virginia", cities: ["Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling", "Martinsburg", "Weirton", "Fairmont", "Beckley", "Clarksburg", "South Charleston", "Vienna", "St. Albans", "Bridgeport", "Bluefield", "Charles Town", "Oak Hill", "Moundsville", "Dunbar", "Hurricane", "Elkins", "Nitro", "Ranson", "Princeton", "Buckhannon", "New Martinsville", "Keyser", "Grafton", "Barboursville", "Westover", "Point Pleasant", "Ravenswood", "Lewisburg", "Weston", "Pleasant Valley", "Welch", "Summersville", "Ripley", "Kingwood", "Williamstown", "Kenova", "Philippi", "Milton", "Williamson", "Fayetteville", "Madison", "Follansbee", "Moorefield", "Bethlehem", "Winfield"] },
    { state: "Wisconsin", cities: ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine", "Appleton", "Sheboygan", "Eau Claire", "Oshkosh", "Janesville", "Waukesha", "La Crosse", "Wauwatosa", "Sheboygan Falls", "Fond du Lac", "New Berlin", "Brookfield", "Wausau", "Menomonee Falls", "Greenfield", "Beloit", "Oak Creek", "Sun Prairie", "West Bend", "Stevens Point", "Superior", "Manitowoc", "Neenah", "Fitchburg", "Muskego", "De Pere", "Caledonia", "Mequon", "Watertown", "Middleton", "Pleasant Prairie", "Germantown", "Howard", "Mount Pleasant", "Onalaska", "Marshfield", "Menomonie", "Chippewa Falls", "Wisconsin Rapids", "Fort Atkinson", "Hartford", "Hudson", "Whitewater", "Stoughton", "Verona"] },
    { state: "Wyoming", cities: ["Cheyenne", "Casper", "Gillette", "Laramie", "Rock Springs", "Sheridan", "Green River", "Evanston", "Riverton", "Jackson", "Cody", "Rawlins", "Lander", "Torrington", "Powell", "Douglas", "Worland", "Buffalo", "Newcastle", "Kemmerer", "Thermopolis", "Saratoga", "Afton", "Alpine", "Baggs", "Bairoil", "Bar Nunn", "Basin", "Bear River", "Big Piney", "Burlington", "Burns", "Byron", "Chugwater", "Clearmont", "Cokeville", "Cowley", "Dayton", "Deaver", "Diamondville", "Dixon", "Dubois", "East Thermopolis", "Edgerton", "Elk Mountain", "Encampment", "Evansville", "Fort Laramie", "Frannie", "Glendo"] }
  ],
  GB: [
    { state: "england", cities: ["london", "manchester", "birmingham", "liverpool", "leeds"] },
    { state: "scotland", cities: ["edinburgh", "glasgow"] },
    { state: "wales", cities: ["cardiff", "swansea"] },
    { state: "northernireland", cities: ["belfast"] },
  ],
  CA: [
    { state: "ontario", cities: ["toronto", "ottawa", "mississauga", "hamilton"] },
    { state: "quebec", cities: ["montreal", "quebeccity", "laval"] },
    { state: "britishcolumbia", cities: ["vancouver", "victoria", "burnaby"] },
    { state: "alberta", cities: ["calgary", "edmonton"] },
  ],
  AE: [
    { state: "abuzaby", cities: ["abudhabi"] },
    { state: "dubai", cities: ["dubai"] },
    { state: "ashshariqah", cities: ["sharjah"] },
  ],
  DE: [
    { state: "berlin", cities: ["berlin"] },
    { state: "bavaria", cities: ["munich", "nuremberg"] },
    { state: "hamburg", cities: ["hamburg"] },
    { state: "hesse", cities: ["frankfurt"] },
  ],
  FR: [
    { state: "iledefrance", cities: ["paris"] },
    { state: "provence", cities: ["marseille", "nice"] },
    { state: "auvergne", cities: ["lyon"] },
  ],
};

/** Common ISP / ASN style slugs users can pick; leave empty for random. */
export const FLEET_COMMON_ISPS = [
  "comcast",
  "verizon",
  "att",
  "spectrum",
  "cox",
  "centurylink",
  "frontier",
  "optimum",
  "t-mobile",
  "bt",
  "virginmedia",
  "skybroadband",
  "rogers",
  "bell",
  "telus",
];

/** Keep only the account prefix; targeting is added later per job. */
export function fleetBaseUsername(user) {
  return String(user || "")
    .trim()
    .replace(/-(country|region|city|isp|session)-.*$/i, "");
}

export function isFleetProxy(proxy) {
  const host = String(proxy?.host || "").toLowerCase();
  const name = String(proxy?.name || "");
  const user = String(proxy?.username || "");
  return (
    host.includes("fleetproxy.io") ||
    name.startsWith("Fleet ·") ||
    /-(country|region|city)-/i.test(user)
  );
}

/** Parse FleetProxy username targeting back into form fields. */
export function parseFleetUsername(username) {
  const raw = String(username || "").trim();
  const base = fleetBaseUsername(raw);
  const country = (raw.match(/-country-([A-Za-z]{2})/i) || [])[1]?.toUpperCase() || "";
  const state = (raw.match(/-region-([a-z0-9_-]+)/i) || [])[1] || "";
  const city = (raw.match(/-city-([a-z0-9_-]+)/i) || [])[1] || "";
  const isp = (raw.match(/-isp-([a-z0-9_-]+)/i) || [])[1] || "";
  const session = (raw.match(/-session-([a-z0-9_-]+)/i) || [])[1] || "";
  return {
    base,
    country: country || "US",
    state,
    city,
    isp,
    rotation: session ? "sticky" : "random",
    session,
  };
}

export function buildFleetUsernameClient(baseUser, targeting = {}) {
  let user = fleetBaseUsername(baseUser);
  if (!user) return "";
  const country = String(targeting.country || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  const region = String(targeting.state || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
  const city = String(targeting.city || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
  const isp = String(targeting.isp || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
  if (country) user += `-country-${country}`;
  if (region) user += `-region-${region}`;
  if (city) user += `-city-${city}`;
  if (isp) user += `-isp-${isp}`;
  if (String(targeting.rotation || "").toLowerCase() === "sticky") {
    const session =
      String(targeting.session || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "") || `s${Date.now().toString(36)}`;
    user += `-session-${session}`;
  }
  return user;
}

export function normalizeFleetHost(host) {
  const value = String(host || "").trim();
  if (!value) return "residential-v2.fleetproxy.io";
  if (value === "v2.fleetproxy.io" || value === "fleetproxy.io") {
    return "residential-v2.fleetproxy.io";
  }
  return value;
}

export function parseFleetProxyLine(line) {
  const text = String(line || "").trim();
  if (!text) return null;

  // user:pass@host:port
  const atMatch = text.match(/^(.*?):(.*?)@([^:]+):(\d+)$/);
  if (atMatch) {
    return {
      user: fleetBaseUsername(atMatch[1]),
      pass: atMatch[2],
      host: normalizeFleetHost(atMatch[3]),
      port: atMatch[4],
    };
  }

  // host:port:user:pass
  const parts = text.split(":");
  if (parts.length >= 4) {
    const [host, port, user, ...passParts] = parts;
    return {
      host: normalizeFleetHost(host),
      port,
      user: fleetBaseUsername(user),
      pass: passParts.join(":"),
    };
  }
  return null;
}

export function regionsForCountry(countryCode) {
  return FLEET_REGIONS_BY_COUNTRY[String(countryCode || "").toUpperCase()] || [];
}
