import { connectDB, disconnectDB } from "./config/db.js";
import User from "./models/User.js";
import WorkerProfile from "./models/WorkerProfile.js";
import ServiceCategory from "./models/ServiceCategory.js";
import Review from "./models/Review.js";
import Enquiry from "./models/Enquiry.js";
import Favorite from "./models/Favorite.js";
import Report from "./models/Report.js";
import AuditLog from "./models/AuditLog.js";
import ChatSession from "./models/ChatSession.js";
import { hashPassword } from "./utils/password.js";
import { recomputeRating } from "./services/workerService.js";
import logger from "./utils/logger.js";

const CATEGORIES = [
  { name: "Plumbing", icon: "droplets", description: "Taps, pipes, leakage, drainage and fittings", keywords: ["plumber", "tap", "leak", "pipe", "drain"] },
  { name: "Electrical", icon: "zap", description: "Wiring, switches, fans, lights and fixtures", keywords: ["electrician", "wiring", "switch", "fan", "light"] },
  { name: "Appliance Repair", icon: "refrigerator", description: "Refrigerators, washing machines and ACs", keywords: ["appliance", "refrigerator", "fridge", "washing machine", "ac"] },
  { name: "Carpentry", icon: "hammer", description: "Doors, furniture, cabinets and woodwork", keywords: ["carpenter", "wood", "door", "furniture"] },
  { name: "Painting", icon: "paintbrush", description: "Interior and exterior painting services", keywords: ["painter", "paint", "wall"] },
  { name: "Cleaning", icon: "sparkles", description: "Home and deep cleaning services", keywords: ["cleaner", "cleaning", "deep clean"] },
  { name: "Vehicle Repair", icon: "car", description: "Two-wheeler and car repair services", keywords: ["mechanic", "bike", "car", "vehicle"] },
  { name: "Computer Repair", icon: "laptop", description: "Laptops, computers and network support", keywords: ["computer", "laptop", "printer", "network"] },
  { name: "Other Local Services", icon: "wrench", description: "Other local handyperson and support services", keywords: ["other", "handyman", "helper"] },
];

interface SeedWorker {
  name: string;
  phone: string;
  email: string;
  location: string;
  approved: boolean;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  rejectionReason?: string;
  profile: {
    professionalDescription: string;
    serviceCategories: string[];
    skills: string[];
    experienceYears: number;
    experienceSummary: string;
    serviceAreas: string[];
    pricing: { type: "fixed" | "hourly" | "quote"; amount?: number; currency: string; note?: string };
    availability: { availableNow: boolean; days: string[]; note?: string };
    portfolioImages?: string[];
  };
  reviews?: { rating: number; comment: string; approved?: boolean }[];
}

const WORKERS: SeedWorker[] = [
  {
    name: "Ramesh Patil", phone: "9800000001", email: "ramesh@example.com", location: "Kolhapur",
    approved: true, verificationStatus: "verified",
    profile: {
      professionalDescription: "Licensed plumber with 8 years of experience in residential repairs, leak detection and bathroom fittings across Kolhapur.",
      serviceCategories: ["Plumbing"], skills: ["Leak Repair", "Pipe Fitting", "Tap & Faucet Repair", "Bathroom Fittings"],
      experienceYears: 8, experienceSummary: "Worked on 600+ home plumbing jobs including emergency leak repairs.",
      serviceAreas: ["Kolhapur", "Pune", "Ichalkaranji"],
      pricing: { type: "hourly", amount: 300, currency: "INR", note: "Minimum 1 hour. Parts charged separately." },
      availability: { availableNow: true, days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], note: "Emergency calls accepted." },
    },
    reviews: [
      { rating: 5, comment: "Fixed our leaking tap quickly and explained the issue clearly.", approved: true },
      { rating: 4, comment: "Punctual and professional. Slightly pricey but good work.", approved: true },
    ],
  },
  {
    name: "Sunita Jadhav", phone: "9800000002", email: "sunita@example.com", location: "Kolhapur",
    approved: true, verificationStatus: "verified",
    profile: {
      professionalDescription: "Appliance repair specialist focused on refrigerators and washing machines. Authorised spare parts and transparent quotes.",
      serviceCategories: ["Appliance Repair"], skills: ["Refrigerator Repair", "Cooling System Troubleshooting", "Washing Machine Repair"],
      experienceYears: 6, experienceSummary: "Repaired more than 900 cooling and washing appliances.",
      serviceAreas: ["Kolhapur", "Sangli"],
      pricing: { type: "quote", currency: "INR", note: "Free diagnosis, quote before repair." },
      availability: { availableNow: true, days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    },
    reviews: [
      { rating: 5, comment: "My fridge is cooling perfectly again. Honest pricing.", approved: true },
      { rating: 5, comment: "Very knowledgeable about washing machine motors.", approved: true },
    ],
  },
  {
    name: "Imran Shaikh", phone: "9800000003", email: "imran@example.com", location: "Kolhapur",
    approved: true, verificationStatus: "verified",
    profile: {
      professionalDescription: "Certified electrician handling rewiring, fan installation, switchboards and inverter setup for homes and small shops.",
      serviceCategories: ["Electrical"], skills: ["Wiring & Rewiring", "Fan Repair", "Switch & Socket Repair", "Inverter Repair"],
      experienceYears: 10, experienceSummary: "Safety-first electrical work with 10 years of field experience.",
      serviceAreas: ["Kolhapur", "Sangli", "Kagal"],
      pricing: { type: "fixed", amount: 500, currency: "INR", note: "Visit charge includes basic inspection." },
      availability: { availableNow: false, days: ["Mon", "Wed", "Fri", "Sat"] },
    },
    reviews: [{ rating: 5, comment: "Rewired our old house neatly and safely.", approved: true }],
  },
  {
    name: "Anita Deshmukh", phone: "9800000004", email: "anita@example.com", location: "Pune",
    approved: true, verificationStatus: "verified",
    profile: {
      professionalDescription: "Home cleaning professional offering regular and deep cleaning with eco-friendly products.",
      serviceCategories: ["Cleaning"], skills: ["Home Cleaning", "Deep Cleaning", "Kitchen Cleaning"],
      experienceYears: 4, experienceSummary: "Regular cleaning partner for 40+ households in Pune.",
      serviceAreas: ["Pune", "Pimpri-Chinchwad"],
      pricing: { type: "hourly", amount: 250, currency: "INR", note: "Materials included." },
      availability: { availableNow: true, days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
    },
    reviews: [{ rating: 5, comment: "Left the house spotless before a family event.", approved: true }],
  },
  {
    name: "Vikas More", phone: "9800000005", email: "vikas@example.com", location: "Kolhapur",
    approved: true, verificationStatus: "verified",
    profile: {
      professionalDescription: "Carpenter crafting and repairing doors, windows, wardrobes and furniture with quality wood.",
      serviceCategories: ["Carpentry"], skills: ["Door Repair", "Furniture Repair", "Wardrobe Fitting", "Furniture Assembly"],
      experienceYears: 12, experienceSummary: "Custom furniture and repairs with a carpentry workshop in Kolhapur.",
      serviceAreas: ["Kolhapur"],
      pricing: { type: "quote", currency: "INR", note: "Quote shared after measurement." },
      availability: { availableNow: true, days: ["Mon", "Tue", "Thu", "Fri", "Sat"] },
    },
    reviews: [
      { rating: 5, comment: "Made a beautiful wardrobe to our exact size.", approved: true },
      { rating: 4, comment: "Good craftsmanship, took a little longer than planned.", approved: true },
    ],
  },
  {
    name: "Prakash Kamble", phone: "9800000006", email: "prakash@example.com", location: "Kolhapur",
    approved: true, verificationStatus: "verified",
    profile: {
      professionalDescription: "Two-wheeler mechanic offering doorstep servicing, engine diagnostics and brake repairs.",
      serviceCategories: ["Vehicle Repair"], skills: ["Two-Wheeler Repair", "Engine Diagnostics", "Brake Repair"],
      experienceYears: 9, experienceSummary: "9 years servicing bikes and scooters, doorstep service available.",
      serviceAreas: ["Kolhapur", "Rukadi"],
      pricing: { type: "hourly", amount: 400, currency: "INR", note: "Doorstep service available." },
      availability: { availableNow: true, days: ["Tue", "Wed", "Thu", "Fri", "Sat"] },
    },
    reviews: [{ rating: 4, comment: "Serviced my scooter at home, very convenient.", approved: true }],
  },
  {
    name: "Neha Joshi", phone: "9800000007", email: "neha@example.com", location: "Pune",
    approved: true, verificationStatus: "pending",
    profile: {
      professionalDescription: "Computer technician for laptop repair, software setup, virus removal and home networking.",
      serviceCategories: ["Computer Repair"], skills: ["Laptop Repair", "Virus Removal", "Network & WiFi Setup", "Operating System Setup"],
      experienceYears: 5, experienceSummary: "IT support for homes and small offices.",
      serviceAreas: ["Pune", "Baner", "Aundh"],
      pricing: { type: "fixed", amount: 600, currency: "INR", note: "Diagnosis included." },
      availability: { availableNow: true, days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    },
    reviews: [{ rating: 5, comment: "Cleaned up a nasty virus and set up our WiFi.", approved: false }],
  },
  {
    name: "Sandeep Rao", phone: "9800000008", email: "sandeep@example.com", location: "Kolhapur",
    approved: true, verificationStatus: "verified",
    profile: {
      professionalDescription: "Painter offering interior painting, wall priming and texture finishes with clean site handling.",
      serviceCategories: ["Painting"], skills: ["Interior Painting", "Wall Priming", "Texture Finishes"],
      experienceYears: 7, experienceSummary: "Painted 100+ homes and offices across Kolhapur.",
      serviceAreas: ["Kolhapur", "Ichalkaranji", "Hatkanangle"],
      pricing: { type: "quote", currency: "INR", note: "Per square foot quote after site visit." },
      availability: { availableNow: false, days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    },
  },
  {
    name: "Kiran Sawant", phone: "9800000009", email: "kiran@example.com", location: "Kolhapur",
    approved: false, verificationStatus: "pending",
    profile: {
      professionalDescription: "Plumber offering general repairs, tap replacement and drainage cleaning. Awaiting verification.",
      serviceCategories: ["Plumbing"], skills: ["Leak Repair", "Drainage Cleaning"],
      experienceYears: 3, experienceSummary: "New to KAMLE AI, 3 years of local experience.",
      serviceAreas: ["Kolhapur"],
      pricing: { type: "hourly", amount: 250, currency: "INR" },
      availability: { availableNow: true, days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    },
  },
  {
    name: "Rahul Pawar", phone: "9800000010", email: "rahul@example.com", location: "Pune",
    approved: false, verificationStatus: "rejected",
    rejectionReason: "The submitted verification document was unclear. Please re-upload a readable copy.",
    profile: {
      professionalDescription: "General electrical helper.",
      serviceCategories: ["Electrical"], skills: ["Light Installation"],
      experienceYears: 1, experienceSummary: "Helper with basic electrical experience.",
      serviceAreas: ["Pune"],
      pricing: { type: "quote", currency: "INR" },
      availability: { availableNow: true, days: [] },
    },
  },
];

async function run() {
  await connectDB();
  logger.info("Seeding KAMLE AI database...");

  await Promise.all([
    User.deleteMany({}), WorkerProfile.deleteMany({}), ServiceCategory.deleteMany({}),
    Review.deleteMany({}), Enquiry.deleteMany({}), Favorite.deleteMany({}),
    Report.deleteMany({}), AuditLog.deleteMany({}), ChatSession.deleteMany({}),
  ]);

  await ServiceCategory.insertMany(
    CATEGORIES.map((c, i) => ({ ...c, slug: c.name.toLowerCase().replace(/\s+/g, "-"), sortOrder: i })),
  );

  const passwordHash = await hashPassword("Password123");

  await User.create({
    name: "KAMLE Admin", phone: "9800000000", email: "admin@kamle.ai",
    passwordHash, role: "admin", accountStatus: "active", location: "Kolhapur",
  });

  const customer = await User.create({
    name: "Aarav Sharma", phone: "9811111111", email: "customer@example.com",
    passwordHash, role: "customer", accountStatus: "active", location: "Kolhapur",
  });
  const customer2 = await User.create({
    name: "Priya Nair", phone: "9822222222", email: "priya@example.com",
    passwordHash, role: "customer", accountStatus: "active", location: "Pune",
  });

  for (const w of WORKERS) {
    const user = await User.create({
      name: w.name, phone: w.phone, email: w.email, passwordHash,
      role: "worker", accountStatus: "active", location: w.location,
    });

    const profile = await WorkerProfile.create({
      userId: user._id,
      ...w.profile,
      portfolioImages: w.profile.portfolioImages ?? [],
      verificationDocuments: w.verificationStatus === "verified"
        ? [{ label: "ID Proof", url: "/uploads/documents/sample-id.pdf" }]
        : [],
      verificationStatus: w.verificationStatus,
      approvalStatus: w.approved ? "approved" : (w.rejectionReason ? "rejected" : "pending"),
      rejectionReason: w.rejectionReason ?? "",
    });

    if (w.reviews?.length) {
      const reviewers = [customer, customer2];
      for (const [index, r] of w.reviews.entries()) {
        // Rotate reviewers so no customer reviews the same worker twice
        // (unique index: customerId_1_workerId_1).
        await Review.create({
          customerId: reviewers[index % reviewers.length]!._id,
          workerId: user._id,
          rating: r.rating,
          comment: r.comment,
          moderationStatus: r.approved ? "approved" : "pending",
        });
      }
    }
    await recomputeRating(String(user._id));
    void profile;
  }

  // A couple of enquiries so dashboards are not empty.
  const plumber = await User.findOne({ phone: "9800000001" }).lean();
  const cleaner = await User.findOne({ phone: "9800000004" }).lean();
  if (plumber) {
    await Enquiry.create({
      customerId: customer._id, workerId: plumber._id, serviceCategory: "Plumbing",
      problemDescription: "Kitchen sink is leaking under the counter.", location: "Kolhapur",
      status: "COMPLETED", statusHistory: [{ status: "sent", at: new Date(), by: customer._id }, { status: "ACCEPTED", at: new Date(), by: plumber._id }, { status: "COMPLETED", at: new Date(), by: plumber._id }],
    });
  }
  if (cleaner) {
    await Enquiry.create({
      customerId: customer2._id, workerId: cleaner._id, serviceCategory: "Cleaning",
      problemDescription: "Need deep cleaning for a 2BHK before moving in.", location: "Pune",
      status: "sent", statusHistory: [{ status: "sent", at: new Date(), by: customer2._id }],
    });
  }

  logger.info("Seed complete.");
  logger.info("Demo logins (password: Password123):");
  logger.info("  admin@kamle.ai / 9800000000");
  logger.info("  customer@example.com / 9811111111");
  logger.info("  ramesh@example.com / 9800000001 (worker)");

  await disconnectDB();
}

run().catch(async (err) => {
  logger.error("Seed failed", err);
  await disconnectDB();
  process.exit(1);
});
