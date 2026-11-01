// // Default business categories and WhatsApp templates (Hinglish). Edit freely in the UI after seeding.
// const CATEGORIES = [
//   ['Hospitals', 'hospitals', ['hospital'], 'Hospital'],
//   ['Clinics', 'clinics', ['doctor'], 'Clinic'],
//   ['Dental Clinics', 'dental clinics', ['dentist'], 'Dental Clinic'],
//   ['Schools', 'schools', ['school'], 'School'],
//   ['Colleges', 'colleges', ['university'], 'College'],
//   ['Coaching Institutes', 'coaching institutes', [], 'School'],
//   ['Beauty Parlours', 'beauty parlours', ['beauty_salon'], 'Beauty Parlour'],
//   ['Salons', 'salons', ['hair_salon'], 'Salon'],
//   ['Restaurants', 'restaurants', ['restaurant'], 'Restaurant'],
//   ['Cafes', 'cafes', ['cafe'], 'Restaurant'],
//   ['Hotels', 'hotels', ['lodging'], 'Hotel'],
//   ['Marriage Gardens', 'marriage gardens', [], 'Hotel'],
//   ['Real Estate Dealers', 'real estate dealers', ['real_estate_agency'], 'Real Estate'],
//   ['Jewellery Shops', 'jewellery shops', ['jewelry_store'], 'E-commerce'],
//   ['Furniture Shops', 'furniture shops', ['furniture_store'], 'E-commerce'],
//   ['Gyms', 'gyms', ['gym'], 'General Business'],
//   ['Automobile Dealers', 'automobile dealers', ['car_dealer'], 'General Business'],
//   ['Medical Stores', 'medical stores', ['pharmacy'], 'Clinic'],
//   ['Travel Agencies', 'travel agencies', ['travel_agency'], 'General Business'],
//   ['Interior Designers', 'interior designers', [], 'General Business'],
//   ['Architects', 'architects', [], 'General Business'],
//   ['Photographers', 'photographers', [], 'General Business'],
//   ['Event Planners', 'event planners', [], 'General Business'],
// ].map(([name, searchTerm, googleTypes, templateCategory]) => ({ name, searchTerm, googleTypes, templateCategory }));

// const SIGN = '\n\nDhanyavaad,\n{{developerName}}\nFull Stack Web Developer';
// const T = (name, category, body) => ({ name, category, body: body + SIGN, isDefault: true });

// const TEMPLATES = [
//   T('General Website Development Pitch', 'General Business',
//     'Namaste {{businessName}} ji,\n\nMain {{developerName}} hoon, ek Full Stack Web Developer.\n\nMain businesses ke liye professional, modern aur mobile-friendly websites develop karta hoon.\n\nMaine aapke business ke baare mein dekha. Agar aap apne business ko online grow karna chahte hain, toh main aapke liye ek professional website aur WhatsApp enquiry system develop kar sakta hoon.\n\nKya main aapko ek demo design dikha sakta hoon?'),
//   T('School Website & Admission Enquiry', 'School',
//     'Namaste {{businessName}} ke Principal/Management ji,\n\nMain {{developerName}} hoon. Main schools ke liye website banata hoon jisme admission enquiry form, notices, gallery aur parents ke liye WhatsApp contact hota hai.\n\n{{city}} mein kai parents ab school online dekhkar decide karte hain. Kya main aapko ek demo dikha sakta hoon?'),
//   T('College Website & Admissions', 'College',
//     'Namaste {{businessName}} ji,\n\nMain {{developerName}} hoon. Colleges ke liye main modern website banata hoon jisme courses, fees, admission form aur student enquiry system hota hai.\n\nKya main aapko ek chhota demo dikha sakta hoon?'),
//   T('Hospital Website & Appointment System', 'Hospital',
//     'Namaste {{businessName}} ji,\n\nMain {{developerName}} hoon. Main hospitals ke liye professional website banata hoon jisme doctors ki list, departments, emergency contact aur online appointment request hoti hai.\n\nKya main aapko ek demo dikha sakta hoon?'),
//   T('Clinic Online Appointment Website', 'Clinic',
//     'Namaste {{ownerName}} ji,\n\nMain {{developerName}} hoon. {{businessName}} ke liye main ek simple website bana sakta hoon jisme patients online appointment ke liye WhatsApp par seedha message kar sakein.\n\nKya main aapko demo dikha sakta hoon?'),
//   T('Dental Clinic Website', 'Dental Clinic',
//     'Namaste {{ownerName}} ji,\n\nMain {{developerName}} hoon. Dental clinics ke liye main website banata hoon jisme treatments, before/after gallery, patient reviews aur appointment booking hoti hai.\n\n{{businessName}} ke liye ek demo design dikhaun?'),
//   T('Salon Booking Website', 'Salon',
//     'Namaste {{businessName}} ji,\n\nMain {{developerName}} hoon. Salons ke liye main website banata hoon jisme services, price list, gallery aur WhatsApp booking button hota hai.\n\nKya main aapko demo dikha sakta hoon?'),
//   T('Beauty Parlour Website', 'Beauty Parlour',
//     'Namaste {{businessName}} ji,\n\nMain {{developerName}} hoon. Beauty parlour ke liye main ek khoobsurat mobile-friendly website banata hoon jisme packages, gallery aur WhatsApp appointment hoti hai.\n\nKya main ek demo bhej sakta hoon?'),
//   T('Restaurant Menu & Order Website', 'Restaurant',
//     'Namaste {{businessName}} ji,\n\nMain {{developerName}} hoon. Restaurants/cafes ke liye main website banata hoon jisme digital menu, photos, location aur WhatsApp par order/table booking hoti hai.\n\nKya main aapko demo dikha sakta hoon?'),
//   T('Hotel Booking Enquiry Website', 'Hotel',
//     'Namaste {{businessName}} ji,\n\nMain {{developerName}} hoon. Hotels aur marriage gardens ke liye main website banata hoon jisme rooms/halls ki photos, rates aur booking enquiry WhatsApp par seedha aati hai.\n\nKya main aapko ek demo dikha sakta hoon?'),
//   T('Real Estate Listings Website', 'Real Estate',
//     'Namaste {{ownerName}} ji,\n\nMain {{developerName}} hoon. Real estate dealers ke liye main property listing website banata hoon jisme photos, location aur buyer enquiry WhatsApp par aati hai.\n\n{{businessName}} ke liye demo dikhaun?'),
//   T('Online Store for Shops', 'E-commerce',
//     'Namaste {{businessName}} ji,\n\nMain {{developerName}} hoon. Main shops ke liye online catalogue/e-commerce website banata hoon taaki {{city}} ke bahar bhi customers aapka saman dekh aur order kar sakein.\n\nKya main aapko ek demo dikha sakta hoon?'),
//   T('Polite Follow-up', 'Follow-up',
//     'Namaste {{businessName}} ji,\n\nMain {{developerName}} hoon. Pichhli baar maine website ke baare mein baat ki thi. Bas yeh poochna tha ki kya aapko demo dekhne ka time mila?\n\nAgar abhi zaroorat nahi hai toh koi baat nahi, bataiye aur main dobara message nahi karunga.'),
// ];

// module.exports = { CATEGORIES, TEMPLATES };



// Default business categories and professional WhatsApp templates.

const CATEGORIES = [
  ['Hospitals', 'hospitals', ['hospital'], 'Hospital'],
  ['Clinics', 'clinics', ['doctor'], 'Clinic'],
  ['Dental Clinics', 'dental clinics', ['dentist'], 'Dental Clinic'],
  ['Schools', 'schools', ['school'], 'School'],
  ['Colleges', 'colleges', ['university'], 'College'],
  ['Coaching Institutes', 'coaching institutes', [], 'School'],
  ['Beauty Parlours', 'beauty parlours', ['beauty_salon'], 'Beauty Parlour'],
  ['Salons', 'salons', ['hair_salon'], 'Salon'],
  ['Restaurants', 'restaurants', ['restaurant'], 'Restaurant'],
  ['Cafes', 'cafes', ['cafe'], 'Restaurant'],
  ['Hotels', 'hotels', ['lodging'], 'Hotel'],
  ['Marriage Gardens', 'marriage gardens', [], 'Hotel'],
  ['Real Estate Dealers', 'real estate dealers', ['real_estate_agency'], 'Real Estate'],
  ['Jewellery Shops', 'jewellery shops', ['jewelry_store'], 'E-commerce'],
  ['Furniture Shops', 'furniture shops', ['furniture_store'], 'E-commerce'],
  ['Gyms', 'gyms', ['gym'], 'General Business'],
  ['Automobile Dealers', 'automobile dealers', ['car_dealer'], 'General Business'],
  ['Medical Stores', 'medical stores', ['pharmacy'], 'Clinic'],
  ['Travel Agencies', 'travel agencies', ['travel_agency'], 'General Business'],
  ['Interior Designers', 'interior designers', [], 'General Business'],
  ['Architects', 'architects', [], 'General Business'],
  ['Photographers', 'photographers', [], 'General Business'],
  ['Event Planners', 'event planners', [], 'General Business'],
].map(([name, searchTerm, googleTypes, templateCategory]) => ({
  name,
  searchTerm,
  googleTypes,
  templateCategory,
}));

const SIGNATURE = `

Regards,
{{developerName}}
Web Development & Digital Solutions`;

const T = (name, category, body, isDefault = false) => ({
  name,
  category,
  body: body + SIGNATURE,
  isActive: true,
  isDefault,
});

const TEMPLATES = [

  // GENERAL BUSINESS

  T(
    'Professional Website Introduction',
    'General Business',
    `Namaste {{businessName}},

Aaj customers kisi business ke products aur services ke baare mein jaanne ke liye online search karte hain.

Main businesses ke liye professional websites develop karta hoon, jahan customers aapki services, photos, contact details aur enquiries easily access kar sakte hain.

Aapke business ke liye ek suitable website concept share karna chahta hoon.

Kya main aapko ek short demo share kar sakta hoon?`,
    true
  ),

  T(
    'Business Growth & Online Presence',
    'General Business',
    `Namaste {{businessName}},

Aapke business ki online presence ko aur professional banane ke liye ek idea share karna chahta hoon.

Ek well-designed website se customers aapki services, business details aur contact information ek hi jagah dekh sakte hain.

Ismein WhatsApp enquiry, service pages aur Google-friendly structure bhi include kiya ja sakta hai.

Kya aap is tarah ki website ka demo dekhna pasand karenge?`
  ),

  // SCHOOL

  T(
    'School Website & Online Admission',
    'School',
    `Namaste {{businessName}},

Parents school select karne se pehle aksar online school details, facilities, activities aur admission information dekhna chahte hain.

Main schools ke liye professional websites develop karta hoon, jisme:

• Online admission enquiry
• Classes aur facilities ki information
• School gallery aur achievements
• Notices aur announcements
• WhatsApp enquiry integration

Aapke school ke liye ek dedicated website concept share kar sakta hoon.

Kya aap iska demo dekhna chahenge?`,
    true
  ),

  T(
    'School Digital Presence',
    'School',
    `Namaste {{businessName}},

School ki important information parents tak easily pahunchane ke liye ek professional website kaafi useful ho sakti hai.

Ismein admission details, fee information, school activities, photo gallery aur enquiry forms ek hi platform par available ho sakte hain.

Saath hi future mein notices aur online admission management bhi add kiya ja sakta hai.

Kya main aapko iska ek sample design share karun?`
  ),

  // COLLEGE

  T(
    'College Website & Admission System',
    'College',
    `Namaste {{businessName}},

Students aur parents ko courses, eligibility, fees aur admission process ki information easily milna important hai.

Main colleges ke liye professional websites develop karta hoon, jisme:

• Course aur department pages
• Online admission enquiry
• Application forms
• Faculty aur campus information
• Notices and announcements
• Student enquiry management

Aapke institution ke liye ek suitable website demo prepare kar sakta hoon.

Kya aap ise dekhna chahenge?`,
    true
  ),

  // HOSPITAL

  T(
    'Hospital Website & Patient Enquiry',
    'Hospital',
    `Namaste {{businessName}},

Patients ko hospital ki facilities, departments, available services aur contact information easily milna bahut important hai.

Main hospitals ke liye professional websites develop karta hoon, jisme:

• Departments aur services
• Doctor profiles
• Appointment enquiry
• Hospital facilities aur gallery
• Location and contact details
• Emergency contact information

Aapke hospital ke liye ek professional website concept share karna chahta hoon.

Kya main iska demo bhej sakta hoon?`,
    true
  ),

  // CLINIC

  T(
    'Clinic Website & Appointment Enquiry',
    'Clinic',
    `Namaste {{businessName}},

Patients ko clinic ki services, timings, location aur appointment process ki information online milna convenient hota hai.

Main clinics ke liye mobile-friendly websites develop karta hoon, jisme:

• Services and treatment details
• Clinic timings and location
• Appointment enquiry
• WhatsApp contact
• Patient information pages

Aapke clinic ke liye ek simple aur professional website demo share kar sakta hoon.

Kya aap dekhna chahenge?`,
    true
  ),

  // DENTAL CLINIC

  T(
    'Dental Clinic Website & Patient Enquiries',
    'Dental Clinic',
    `Namaste {{businessName}},

Dental clinic ki treatments, facilities aur appointment information ko professionally present karne ke liye website useful ho sakti hai.

Main dental clinics ke liye websites develop karta hoon, jisme:

• Dental treatments and services
• Clinic introduction
• Treatment gallery
• Appointment enquiry
• WhatsApp contact integration
• Location and timings

Aapke clinic ke liye ek relevant website design concept share karna chahta hoon.

Kya main demo bhejun?`,
    true
  ),

  // SALON

  T(
    'Salon Website & Online Booking',
    'Salon',
    `Namaste {{businessName}},

Customers ko salon ki services, pricing, photos aur booking options ek hi jagah milna unke experience ko convenient bana sakta hai.

Main salons ke liye modern websites develop karta hoon, jisme:

• Services and pricing
• Photo gallery
• Online appointment enquiry
• WhatsApp booking
• Location and contact details

Aapke salon ke liye ek attractive website concept share kar sakta hoon.

Kya aap iska demo dekhna chahenge?`,
    true
  ),

  // BEAUTY PARLOUR

  T(
    'Beauty Parlour Website & Appointment System',
    'Beauty Parlour',
    `Namaste {{businessName}},

Beauty services aur packages ko professionally showcase karne ke liye ek modern website useful ho sakti hai.

Ismein services, packages, photos, customer enquiries aur WhatsApp appointment facility include ki ja sakti hai.

Isse interested customers ko aapki services samajhne aur appointment enquiry karne mein aasani hogi.

Kya aap apne parlour ke liye ek website demo dekhna chahenge?`,
    true
  ),

  // RESTAURANT

  T(
    'Restaurant Digital Menu & Website',
    'Restaurant',
    `Namaste {{businessName}},

Customers restaurant visit karne se pehle menu, food photos, location aur contact details dekhna pasand karte hain.

Main restaurants ke liye professional websites develop karta hoon, jisme:

• Digital food menu
• Food and restaurant gallery
• Table booking enquiry
• WhatsApp ordering enquiry
• Location and contact details

Aapke restaurant ke liye ek digital menu aur website demo share kar sakta hoon.

Kya aap dekhna chahenge?`,
    true
  ),

  // HOTEL

  T(
    'Hotel Website & Booking Enquiries',
    'Hotel',
    `Namaste {{businessName}},

Travel karne wale customers hotel ki rooms, facilities, photos, location aur booking details online check karte hain.

Main hotels ke liye professional websites develop karta hoon, jisme:

• Room and facility details
• Photo gallery
• Booking enquiry forms
• WhatsApp contact
• Location and directions
• Offers and packages

Aapke hotel ke liye ek suitable website demo share karna chahta hoon.

Kya aap ise dekhna chahenge?`,
    true
  ),

  // REAL ESTATE

  T(
    'Real Estate Website & Property Enquiries',
    'Real Estate',
    `Namaste {{businessName}},

Property search karne wale customers ko available properties, photos, locations aur pricing information easily milna important hai.

Main real estate businesses ke liye property listing websites develop karta hoon, jisme:

• Property listings
• Property photos and details
• Location and pricing
• Buyer enquiry forms
• WhatsApp enquiry integration
• Search and filter options

Aapke business ke liye ek property website concept share kar sakta hoon.

Kya main iska demo bhejun?`,
    true
  ),

  // E-COMMERCE

  T(
    'Online Store & Product Catalogue',
    'E-commerce',
    `Namaste {{businessName}},

Aapke products ko online showcase karne aur customers se enquiries ya orders receive karne ke liye ek professional website useful ho sakti hai.

Main businesses ke liye online catalogue aur e-commerce websites develop karta hoon, jisme:

• Product catalogue
• Product images and details
• Online enquiry or ordering
• Shopping cart and checkout
• Payment integration
• Order management

Aapke business ke liye ek suitable online store demo share kar sakta hoon.

Kya aap dekhna chahenge?`,
    true
  ),

  // FOLLOW-UP

  T(
    'Follow-up After Initial Introduction',
    'Follow-up',
    `Namaste {{businessName}},

Main apne previous message ke regarding ek short follow-up kar raha hoon.

Maine aapke business ke liye professional website ka idea share kiya tha, jisse customers aapki services aur contact details easily access kar saken.

Agar ye aapke liye relevant hai, toh main ek short demo share kar sakta hoon.

Kya aap interested hain?`,
    true
  ),

  T(
    'Follow-up With Demo Offer',
    'Follow-up',
    `Namaste {{businessName}},

Aapko disturb karne ke liye maafi chahta hoon. Main bas apne previous website proposal ke regarding follow-up kar raha hoon.

Agar aap chahein toh main aapke business type ke according ek sample website design share kar sakta hoon.

Isse aapko idea mil jayega ki aapke business ki online presence kaisi ho sakti hai.

Kya demo share karna convenient rahega?`
  ),

  T(
    'Final Polite Follow-up',
    'Follow-up',
    `Namaste {{businessName}},

Website development ke regarding mera ye final follow-up hai.

Agar filhaal aapki website ki requirement nahi hai, toh bilkul koi problem nahi.

Future mein kabhi website, online enquiry system ya business automation ki requirement ho, toh aap mujhse contact kar sakte hain.

Thank you for your time.`
  ),

  // CUSTOM

  T(
    'Custom Business Website Proposal',
    'Custom',
    `Namaste {{businessName}},

Main aapke business ke liye ek customized digital solution develop karne ke regarding contact kar raha hoon.

Requirement ke according website, online enquiry system, booking platform, customer management ya custom software develop kiya ja sakta hai.

Mera focus aise solutions par hota hai jo business ke actual workflow aur customer requirements ke according design kiye jaayen.

Kya aap apni current digital requirements share karna chahenge?`
  ),
];

module.exports = { CATEGORIES, TEMPLATES };