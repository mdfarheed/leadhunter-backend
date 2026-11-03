// Default business categories and professional WhatsApp templates (natural Hinglish).
//
// Rules every template follows (enforced by tests/templates.test.js):
//   - exactly FIVE starter templates for each of the 14 message categories
//   - greeting is always "Namaste {{businessName}}," - no "Sir / Madam / Principal / Manager / Owner / Ji"
//   - only supported placeholders ({{businessName}}, {{category}}, {{city}}, {{developerName}})
//   - no guaranteed-results, income or "get more customers" promises; nothing misleading
//   - medical categories avoid testimonials / before-after / results claims (professional advertising rules differ)
//   - every message introduces the SENDER ("Main {{myCity}} se hoon, mera naam {{developerName}} hai": each user's own city and name),
//     ends with a YES / STOP line, then the signature. The lead's city ({{city}}) is only used where it is true, e.g. "{{city}} mein ..."

//
// These are meant to be CHOSEN by the admin for relevance (and edited before opening WhatsApp). They are never rotated or
// randomised automatically, and nothing here sends a message.

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

// Every message ends with a clear question (reply YES if interested) and an easy opt-out (type STOP).
const CLOSING = `Agar aap interested hain, to "YES" bol dijiye. Agar aapko is tarah ke messages nahi chahiye, to "STOP" type kar dijiye.`;

const SIGNATURE = `\n\nRegards,\n{{developerName}}\nWeb Development & Digital Solutions`;

const slug = (c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const counters = {};
// T(category, name, body): seedKey is stable ("school-3") so re-running the seed never duplicates and customisations are never overwritten.
const T = (category, name, body) => {
  counters[category] = (counters[category] || 0) + 1;
  return {
    seedKey: `${slug(category)}-${counters[category]}`,
    name,
    category,
    body: `${body.trim()}\n\n${CLOSING}${SIGNATURE}`,
    isActive: true,
    isDefault: counters[category] === 1, // template #1 of each category is its default; the admin can change this in the UI
  };
};

const TEMPLATES = [

  // ---------- GENERAL BUSINESS ----------
  T('General Business', 'Website Introduction',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main website development aur digital solutions par kaam karta hoon.

{{city}} mein bahut se log kisi bhi business ko pehle online search karke dekhte hain. Ek simple, mobile-friendly website par aapki services, contact details aur location ek hi jagah mil sakti hain.

Agar aap chahein, to {{businessName}} ke liye ek sample design share kar sakta hoon.`),
  T('General Business', 'WhatsApp Enquiry Button',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main aise websites banata hoon jahan visitor ek click mein aapko WhatsApp par enquiry bhej sake.

Isse aapke customers ko baar-baar number dhundhna nahi padta, aur aapki services ki details bhi ek jagah dikh jaati hain.

Kya main aapko ek chhota sa sample dikha sakta hoon?`),
  T('General Business', 'Services & Contact Page',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main {{businessName}} ke baare mein online dekh raha tha.

Ek apni website par aap services, timings, photos aur contact details apne tareeke se present kar sakte hain, aur customers ko sab ek jagah mil jata hai.

Agar aapko is par kaam karna interesting lage, to main kuch design ideas share kar sakta hoon.`),
  T('General Business', 'Portfolio & Photo Showcase',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Agar aapke paas apne kaam ki photos ya projects hain, to ek website par unhe achhe se organise karke dikhaya ja sakta hai.

Visitor ek hi jagah aapke kaam, services aur contact options dekh sakta hai.

Chahein to main {{businessName}} ke liye ek sample layout share kar dun?`),
  T('General Business', 'Requirement Discussion',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main website aur digital tools banane ka kaam karta hoon.

Abhi koi pitch nahi, bas yeh jaanna chahta hoon ki {{businessName}} ke liye online side par kya useful ho sakta hai: website, enquiry form, ya kuch aur.

Agar aapke paas 5 minute hon, to apni requirement share kar dijiye, main uske hisaab se suggestion de dunga.`),

  // ---------- SCHOOL ----------
  T('School', 'Website & Admission Enquiry',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main schools ke liye website banata hoon jisme admission enquiry form, classes ki jaankari aur contact details ek jagah milte hain.

Parents aksar admission se pehle online school ke baare mein dekhte hain, isliye ye jaankari clear aur updated honi chahiye.

Kya main {{businessName}} ke liye ek sample design share kar sakta hoon?`),
  T('School', 'Parents Information Hub',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. School website par notices, fee structure, timetable aur holiday list jaisi baatein ek jagah rakhi ja sakti hain, taaki parents ko baar-baar call na karna pade.

Content aap khud bhi update kar sakein, aisa simple system banaya ja sakta hai.

Agar aap chahein, to main iska ek demo dikha sakta hoon.`),
  T('School', 'Gallery, Events & Achievements',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Annual day, sports day aur competitions ki photos ko ek sundar gallery mein dikhane ke liye school website ek achha tareeka hai.

Isse parents aur naye students school ki activities ek nazar mein dekh sakte hain.

Kya main {{businessName}} ke liye ek sample gallery layout bhej dun?`),
  T('School', 'Mobile-Friendly School Website',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Zyada tar parents school ki jaankari mobile par dekhte hain, isliye website ka phone par saaf aur tez chalna zaroori hai.

Main {{city}} ke schools ke liye aisi hi mobile-friendly websites banata hoon, jisme admission form aur contact button easily mil jaye.

Agar aap chahein, to ek demo link share kar sakta hoon.`),
  T('School', 'Short Demo Request',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main schools ke liye website aur admission enquiry system banata hoon.

Agar aap permission dein, to main 10 minute mein ek demo dikha sakta hoon: call par ya aapke time ke hisaab se.

Aapko kaunsa time theek rahega?`),

  // ---------- COLLEGE ----------
  T('College', 'Courses & Admission Website',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Students aur parents ko courses, eligibility, fees aur admission process ek jagah clearly dikhna zaroori hai.

Main colleges ke liye website banata hoon jisme course pages, admission enquiry form aur contact details hote hain.

Kya main {{businessName}} ke liye ek sample structure share kar sakta hoon?`),
  T('College', 'Student Enquiry & Counselling Form',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. College website par ek simple enquiry form lagaya ja sakta hai jisse interested students apna course aur contact detail bhej saken.

Aap un enquiries ko ek jagah dekh kar apne hisaab se follow up kar sakte hain.

Agar aap chahein, to main iska demo dikha sakta hoon.`),
  T('College', 'Campus, Events & Notices',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Campus ki photos, events, seminar aur notices ko ek organised website par rakhna students ke liye kaafi convenient hota hai.

Main aisa layout bana sakta hoon jahan aap khud notices update kar saken.

Kya main {{businessName}} ke liye ek sample design bhej dun?`),
  T('College', 'Department & Faculty Pages',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Har department ke liye alag page, faculty ki jaankari aur syllabus ya downloads ka section website par banaya ja sakta hai.

Isse students ko zaroori jaankari dhundhne mein aasani hoti hai.

Agar aap chahein, to main ek sample department page dikha sakta hoon.`),
  T('College', 'Short Demo Request',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main colleges ke liye website aur admission enquiry system banata hoon.

Agar aap permission dein, to main ek chhota demo dikhana chahunga. Koi commitment nahi hai.

Aapke liye kaunsa time suitable rahega?`),

  // ---------- HOSPITAL ----------
  T('Hospital', 'Patient Information Website',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Patients aur unke parivaar ko hospital ki departments, facilities, timings aur contact details clearly milni chahiye.

Main hospitals ke liye aisi website banata hoon jahan ye sab jaankari ek jagah, aasan bhasha mein dikhai jaye.

Kya main {{businessName}} ke liye ek sample design share kar sakta hoon?`),
  T('Hospital', 'Doctors & Departments Pages',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Website par har department aur doctor ka alag page ban sakta hai, jisme qualification, specialisation aur OPD timing diya ja sake.

Content aapke professional guidelines ke hisaab se hi rakha jayega.

Agar aap chahein, to main ek sample page dikha sakta hoon.`),
  T('Hospital', 'Appointment Request Form',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Ek simple appointment request form lagaya ja sakta hai jisse patient apni preferred date aur department bata sake, aur aapki team confirm karke wapas contact kare.

Isse front desk par phone ka load kam ho sakta hai.

Kya main iska demo dikha sakta hoon?`),
  T('Hospital', 'Emergency Contact & Location',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Emergency number, ambulance contact aur Google Maps location ko website par aisi jagah rakha ja sakta hai jahan wo turant dikh jaye.

Ye chhoti si baat zaroorat ke samay kaafi kaam aa sakti hai.

Agar aap chahein, to main {{businessName}} ke liye ek sample layout bhej sakta hoon.`),
  T('Hospital', 'Health Awareness & Notices',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Website par health camps, notices aur general awareness ka ek section bhi banaya ja sakta hai, jise aap khud update kar saken.

Isse patients ko hospital ki activities ke baare mein jaankari milti rehti hai.

Kya main iska ek short demo share kar dun?`),

  // ---------- CLINIC ----------
  T('Clinic', 'Clinic Website with Timings',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Patients ko clinic ki timings, location aur services ek jagah dikhna convenient hota hai.

Main clinics ke liye simple, mobile-friendly website banata hoon jisme ye sab details aur contact button hote hain.

Kya main {{businessName}} ke liye ek sample design share kar sakta hoon?`),
  T('Clinic', 'Appointment Request Form',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Website par ek appointment request form lagaya ja sakta hai jisme patient apna naam, number aur preferred time bhej sake.

Aap apni suvidha se un requests ko dekh kar confirm kar sakte hain.

Agar aap chahein, to main iska demo dikha sakta hoon.`),
  T('Clinic', 'Doctor Profile & Services',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Doctor ka introduction, qualification aur clinic ki services ko ek professional page par dikhaya ja sakta hai.

Content aapke professional guidelines ke hisaab se rakha jata hai.

Kya main ek sample profile page share kar dun?`),
  T('Clinic', 'Location, Directions & Contact',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Naye patients ko clinic dhundhne mein aksar dikkat hoti hai. Website par map, landmark aur directions clearly diye ja sakte hain.

Saath mein click-to-call aur WhatsApp enquiry button bhi lag sakta hai.

Agar aap chahein, to main {{businessName}} ke liye ek chhota demo bana kar dikha sakta hoon.`),
  T('Clinic', 'Short Demo Request',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main clinics ke liye website aur appointment request system banata hoon.

Agar aap permission dein, to main ek 10 minute ka demo dikhana chahunga. Koi pressure nahi hai.

Aapko kaunsa time theek rahega?`),

  // ---------- DENTAL CLINIC ----------
  T('Dental Clinic', 'Treatments Information Website',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Dental clinics ke liye main website banata hoon jahan treatments, clinic timings aur contact details saaf tareeke se likhe hote hain.

Patients ko process samajhne mein aasani hoti hai aur wo clinic tak pahunchne se pehle zaroori jaankari dekh lete hain.

Kya main {{businessName}} ke liye ek sample design share kar sakta hoon?`),
  T('Dental Clinic', 'Appointment Enquiry Form',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Website par ek simple appointment enquiry form lagaya ja sakta hai jisme patient apna concern aur preferred time bata sake.

Aap suvidha se unhe confirm kar sakte hain, aur phone par bar-bar poochne ki zaroorat kam ho sakti hai.

Agar aap chahein, to main iska demo dikha sakta hoon.`),
  T('Dental Clinic', 'Clinic Gallery & Facilities',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Clinic ki reception, equipment aur team ki photos ek gallery mein dikhane se naye patients ko clinic ka environment pehle se samajh aa jata hai.

Sab content aapke professional advertising guidelines ke andar hi rakha jata hai.

Kya main ek sample gallery layout bhej dun?`),
  T('Dental Clinic', 'Dental Care Tips Section',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Website par ek chhota section ban sakta hai jahan brushing, checkup schedule jaisi general dental care tips aap khud likh kar daal saken.

Isse patients ko useful jaankari milti hai aur clinic ki website active rehti hai.

Agar aap chahein, to main ek demo share kar sakta hoon.`),
  T('Dental Clinic', 'Short Demo Request',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main dental clinics ke liye website aur appointment enquiry system banata hoon.

Agar aap permission dein, to main ek chhota demo dikhana chahunga. Koi commitment nahi hai.

Aapke liye kaunsa time suitable rahega?`),

  // ---------- SALON ----------
  T('Salon', 'Services & Price List Website',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Customers aksar salon jaane se pehle services aur rates dekhna chahte hain.

Main salons ke liye website banata hoon jisme services, price list, timings aur location ek jagah hoti hain.

Kya main {{businessName}} ke liye ek sample design share kar sakta hoon?`),
  T('Salon', 'Booking Enquiry via WhatsApp',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Website par ek "Book on WhatsApp" button lagaya ja sakta hai jisse customer service chun kar seedha aapko message bhej sake.

Isse appointment ki baat-cheet aasan ho jati hai.

Agar aap chahein, to main iska demo dikha sakta hoon.`),
  T('Salon', 'Photo Gallery & Styles',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Salon ke haircut, styling aur interior ki photos ek achhi gallery mein dikhane se customers ko aapka kaam samajhne mein madad milti hai.

Main aisi gallery banata hoon jo mobile par bhi tez chale.

Kya main ek sample layout bhej dun?`),
  T('Salon', 'Packages & Membership Page',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Agar aap packages ya membership offer karte hain, to unhe website par clearly present kiya ja sakta hai, taaki customers ko samajhne mein aasani ho.

Offers aap khud kabhi bhi update kar sakein, aisa setup ban sakta hai.

Agar aap chahein, to main {{businessName}} ke liye ek sample dikha sakta hoon.`),
  T('Salon', 'Short Demo Request',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main salons ke liye website aur booking enquiry system banata hoon.

Agar aap permission dein, to main ek 10 minute ka demo dikhana chahunga. Koi pressure nahi hai.

Aapko kaunsa time theek rahega?`),

  // ---------- BEAUTY PARLOUR ----------
  T('Beauty Parlour', 'Packages & Services Website',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Beauty parlour ke liye ek website banayi ja sakti hai jisme facial, hair, makeup jaise services aur packages saaf tareeke se dikhaye jayein.

Customers ghar baithe sab jaankari dekh sakti hain aur apni pasand ka package samajh sakti hain.

Kya main {{businessName}} ke liye ek sample design share kar sakta hoon?`),
  T('Beauty Parlour', 'Bridal Packages Showcase',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Agar aap bridal ya party makeup ke packages dete hain, to unhe ek alag page par photos ke saath dikhaya ja sakta hai.

Customer wahin se aapko enquiry bhi bhej sakti hai.

Agar aap chahein, to main ek sample page dikha sakta hoon.`),
  T('Beauty Parlour', 'Appointment Enquiry on WhatsApp',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Website par ek WhatsApp appointment button lagaya ja sakta hai jisse customer service aur preferred time ke saath message bhej sake.

Isse aapko call par baar-baar details poochni nahi padti.

Kya main iska demo dikha dun?`),
  T('Beauty Parlour', 'Gallery & Work Showcase',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Aapke kaam ki photos ek sundar gallery mein dikhane se naye customers ko parlour ka style samajhne mein madad milti hai.

Photos aap hi provide karein, main unhe achhe layout mein set kar dunga.

Chahein to main ek sample gallery bhej sakta hoon.`),
  T('Beauty Parlour', 'Short Demo Request',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main beauty parlours ke liye website aur appointment enquiry system banata hoon.

Agar aap permission dein, to main ek chhota demo dikhana chahunga. Koi commitment nahi hai.

Aapke liye kaunsa time suitable rahega?`),

  // ---------- RESTAURANT ----------
  T('Restaurant', 'Digital Menu Website',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Customers restaurant jaane se pehle menu, rates aur photos dekhna pasand karte hain.

Main aisi website banata hoon jisme digital menu, timings, location aur contact ek jagah hote hain, aur menu aap khud update kar sakte hain.

Kya main {{businessName}} ke liye ek sample design share kar sakta hoon?`),
  T('Restaurant', 'Table Booking Enquiry',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Website par ek table booking enquiry form lagaya ja sakta hai jisme guest date, time aur logon ki sankhya bata sake.

Aap booking confirm karne se pehle sab details ek jagah dekh sakte hain.

Agar aap chahein, to main iska demo dikha sakta hoon.`),
  T('Restaurant', 'WhatsApp Order Enquiry',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Menu ke saath ek "Order on WhatsApp" button lagaya ja sakta hai jisse customer apna order seedha aapko message kar sake.

Ye un restaurants ke liye simple option hai jo apna order system khud handle karte hain.

Kya main ek sample dikha dun?`),
  T('Restaurant', 'Food Photos & Location',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Khane ki achhi photos, restaurant ka ambience aur Google Maps location ek hi page par dikhane se naye customers ko aapko dhundhna aasan ho jata hai.

Main aisa mobile-friendly layout banata hoon jo tez khule.

Agar aap chahein, to {{businessName}} ke liye ek sample bhej sakta hoon.`),
  T('Restaurant', 'Events & Party Bookings',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Birthday, family dinner ya small party ke liye ek alag enquiry page website par banaya ja sakta hai, jisme hall, capacity aur contact detail ho.

Isse party ki enquiries ek jagah aa sakti hain.

Kya main iska demo dikha sakta hoon?`),

  // ---------- HOTEL ----------
  T('Hotel', 'Rooms & Facilities Website',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Travellers aksar booking se pehle rooms, facilities, photos aur location online dekhte hain.

Main hotels ke liye aisi website banata hoon jahan ye sab jaankari saaf aur mobile-friendly tareeke se dikhai jati hai.

Kya main {{businessName}} ke liye ek sample design share kar sakta hoon?`),
  T('Hotel', 'Booking Enquiry Form',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Website par ek booking enquiry form lagaya ja sakta hai jisme guest check-in date, room type aur contact detail bhej sake.

Aap enquiry dekh kar apni availability ke hisaab se wapas contact kar sakte hain.

Agar aap chahein, to main iska demo dikha sakta hoon.`),
  T('Hotel', 'Photo Gallery & Nearby Places',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Hotel ke rooms ki photos ke saath aas-paas ke mandir, bazaar ya stations ki jaankari bhi website par di ja sakti hai, jo guests ke kaam aati hai.

Map aur directions bhi saath mein lag jate hain.

Kya main ek sample layout bhej dun?`),
  T('Hotel', 'Banquet & Event Enquiries',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Agar aapke paas banquet hall ya garden hai, to uske liye alag page bana kar capacity, photos aur enquiry form diya ja sakta hai.

Shaadi ya function ki enquiries ek jagah aa sakti hain.

Agar aap chahein, to main iska ek sample dikha sakta hoon.`),
  T('Hotel', 'Short Demo Request',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main hotels aur guest houses ke liye website aur booking enquiry system banata hoon.

Agar aap permission dein, to main ek 10 minute ka demo dikhana chahunga. Koi pressure nahi hai.

Aapko kaunsa time theek rahega?`),

  // ---------- REAL ESTATE ----------
  T('Real Estate', 'Property Listing Website',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Property dhundhne wale log aksar online listings, photos aur location dekhkar shortlist karte hain.

Main real estate businesses ke liye aisi website banata hoon jisme properties ki details, photos aur contact ek jagah hoti hain.

Kya main {{businessName}} ke liye ek sample design share kar sakta hoon?`),
  T('Real Estate', 'Buyer Enquiry Form',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Har property ke saath ek enquiry form lagaya ja sakta hai jisme interested person apna budget aur contact detail bhej sake.

Aap saari enquiries ek jagah dekh kar apne hisaab se contact kar sakte hain.

Agar aap chahein, to main iska demo dikha sakta hoon.`),
  T('Real Estate', 'Project & Brochure Pages',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Kisi project ke liye alag page banaya ja sakta hai jisme layout, amenities, photos aur brochure download ka option ho.

Sab details aap provide karein, main unhe clear tareeke se present kar dunga.

Kya main ek sample project page bhej dun?`),
  T('Real Estate', 'Location Map & Photo Gallery',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Property ki location Google Map par dikhana aur photos ko gallery mein rakhna buyers ke liye kaafi helpful hota hai.

Website mobile par bhi saaf dikhti hai, jahan zyada tar log search karte hain.

Agar aap chahein, to {{businessName}} ke liye ek sample dikha sakta hoon.`),
  T('Real Estate', 'Short Demo Request',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main real estate businesses ke liye property listing website banata hoon.

Agar aap permission dein, to main ek chhota demo dikhana chahunga. Koi commitment nahi hai.

Aapke liye kaunsa time suitable rahega?`),

  // ---------- E-COMMERCE ----------
  T('E-commerce', 'Online Product Catalogue',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Aapke products ko photos, naam aur price ke saath ek online catalogue mein dikhaya ja sakta hai, jise customers kahin se bhi dekh saken.

Catalogue aap khud update kar sakein, aisa setup banaya ja sakta hai.

Kya main {{businessName}} ke liye ek sample design share kar sakta hoon?`),
  T('E-commerce', 'Online Store with Orders',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Agar aap online orders lena chahte hain, to ek simple online store banaya ja sakta hai jisme cart, checkout aur order list ho.

Payment ke liye trusted payment gateways ka option diya ja sakta hai.

Agar aap chahein, to main iska demo dikha sakta hoon.`),
  T('E-commerce', 'WhatsApp Catalogue & Order Button',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Agar abhi aap WhatsApp par hi orders lete hain, to website par har product ke saath "Order on WhatsApp" button lagaya ja sakta hai.

Isse customer ko product ki details aur order, dono ek jagah mil jate hain.

Kya main ek sample dikha dun?`),
  T('E-commerce', 'Product Categories & Search',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Jab products zyada ho jate hain, to categories aur search option se customer ko apni cheez dhundhna aasan hota hai.

Main aisi website banata hoon jo phone par bhi tez aur saaf chale.

Agar aap chahein, to {{businessName}} ke liye ek sample layout bhej sakta hoon.`),
  T('E-commerce', 'Short Demo Request',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main shops aur sellers ke liye online catalogue aur store websites banata hoon.

Agar aap permission dein, to main ek 10 minute ka demo dikhana chahunga. Koi pressure nahi hai.

Aapko kaunsa time theek rahega?`),

  // ---------- FOLLOW-UP ----------
  T('Follow-up', 'Gentle Check-in',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Pichhli baar maine website ke baare mein baat ki thi, bas yeh poochna chahta tha ki aapko dekhne ka mauka mila ya nahi.

Agar abhi zaroorat nahi hai, to bilkul theek hai.`),
  T('Follow-up', 'Sample Design Offer',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Pichhle message ke baad maine socha ki agar aap chahein, to {{businessName}} ke liye ek sample design bana kar dikha dun, taaki aapko idea mil sake.

Agar aap interested hon, to bas bata dijiye.`),
  T('Follow-up', 'Requirement Question',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Ek chhota sa sawal tha: {{businessName}} ke liye aapko website mein sabse zaroori kya lagta hai: enquiry form, photo gallery, ya online booking?

Aapka jawab mujhe sahi suggestion dene mein madad karega.`),
  T('Follow-up', 'Convenient Time to Talk',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Pichhli baat-cheet ke baad agar aap chahein, to main 10 minute ke call par details samjha sakta hoon.

Aapko kaunsa time suitable rahega? Aap batayein, main usi hisaab se contact karunga.`),
  T('Follow-up', 'Final Polite Follow-up',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Website ke regarding ye mera aakhri follow-up hai.

Agar abhi aapki requirement nahi hai, to koi baat nahi. Aage kabhi zaroorat ho, to aap mujhse sampark kar sakte hain.

Aapke time ke liye dhanyavaad.`),

  // ---------- CUSTOM ----------
  T('Custom', 'Custom Website Proposal',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Har business ki zaroorat alag hoti hai, isliye main aapke kaam ke hisaab se website ya digital tool design karta hoon.

Agar aap apni requirement bata dein, to main {{businessName}} ke liye ek simple proposal share kar sakta hoon.`),
  T('Custom', 'Booking or Enquiry System',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Agar aapke customers appointment, booking ya enquiry karte hain, to uske liye ek simple online form aur list system banaya ja sakta hai.

Isse enquiries ek jagah organised rehti hain.

Kya main iska ek short demo dikha sakta hoon?`),
  T('Custom', 'Business Dashboard & Records',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Customer records, orders ya follow-ups register mein sambhalna mushkil ho sakta hai. Main ek simple web dashboard bana sakta hoon jahan ye sab ek jagah dikhe.

Agar aap chahein, to aap batayein ki aap kya track karna chahte hain, main uske hisaab se idea share karunga.`),
  T('Custom', 'Website Redesign',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Agar aapki website purani hai ya mobile par theek se nahi khulti, to main use naya aur saaf design de sakta hoon, aapke existing content ke saath.

Chahein to main current site dekh kar kuch improvement ideas share kar dun?`),
  T('Custom', 'Requirement Discussion',
    `Namaste {{businessName}},

Main {{myCity}} se hoon, mera naam {{developerName}} hai. Main website aur custom digital tools banane ka kaam karta hoon.

Abhi koi pitch nahi, bas yeh samajhna chahta hoon ki {{businessName}} ke liye aapko kis cheez ki zaroorat hai. Agar aap batayein, to main sahi suggestion de sakta hoon.`),
];

module.exports = { CATEGORIES, TEMPLATES, CLOSING, SIGNATURE };
