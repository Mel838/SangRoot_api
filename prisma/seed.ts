/**
 * SangRoot Database Seed Script — V2 Dual Coordinator Edition
 * ────────────────────────────────────────────────────────────
 * Covers ALL 10 Cameroonian regions with realistic data.
 * Includes PhoneNumberRegistry for WhatsApp routing.
 *
 * Run:  npx prisma db seed
 */

import 'dotenv/config';
import {
  PrismaClient,
  BloodGroup,
  Gender,
  CameroonRegion,
  RequestUrgency,
  RequestStatus,
  Hospital,
  BloodBank,
  DonorConversationState,
  BloodBankConversationState,
  OutreachTaskStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const prisma = new PrismaClient({ adapter } as any);

// ─── Team phone numbers (exact — never altered) ──────────────────────────────
const TEAM_PHONES = [
  '+237722603920',
  '+237678203008',
  '+237690063123',
  '+237714462260',
  '+237679678620',
  '+237652328873',
];

let globalPhoneIdx = 0;

/**
 * Cycles through the 6 exact team numbers endlessly.
 */
function nextPhone(): string {
  if (globalPhoneIdx < TEAM_PHONES.length) {
    return TEAM_PHONES[globalPhoneIdx++];
  }
  // sequence for others to avoid uniqueness error
  const seq = globalPhoneIdx++ - TEAM_PHONES.length + 1;
  return `+237700${String(seq).padStart(6, '0')}`;
}

/**
 * Registry formatting (E.164 without +)
 */
function formatForRegistry(phone: string): string {
  return phone.replace(/\+/g, '').replace(/\s/g, '').trim();
}

/**
 * Returns a phone number for a Donor.
 */
let donorPhoneIdx = 0;
function donorPhone(): string {
  if (donorPhoneIdx < TEAM_PHONES.length) {
    return TEAM_PHONES[donorPhoneIdx++];
  }
  const seq = donorPhoneIdx++ - TEAM_PHONES.length + 1;
  return `+237600${String(seq).padStart(6, '0')}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function hash(plain: string) {
  return bcrypt.hash(plain, 10);
}

function randomBloodGroup(): BloodGroup {
  const groups = Object.values(BloodGroup);
  return groups[Math.floor(Math.random() * groups.length)];
}

function randomGender(): Gender {
  return Math.random() > 0.5 ? Gender.MALE : Gender.FEMALE;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function birthDate(minAge = 18, maxAge = 60): Date {
  const year =
    new Date().getFullYear() -
    minAge -
    Math.floor(Math.random() * (maxAge - minAge));
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );
}

async function main() {
  console.log('🌱 Seeding V2 database — all 10 Cameroonian regions…\n');

  // 1. CLEAR DATA (Optional — for clean re-seed)
  // console.log('  ⚠️  Cleaning existing data...');
  // await prisma.phoneNumberRegistry.deleteMany({});
  // await prisma.outreachTask.deleteMany({});
  // ... rest of deletions ...

  // 1. HOSPITALS (10 total)
  const hospitalData = [
    {
      email: 'admin@hopital-central-yaounde.cm',
      name: 'Hôpital Central de Yaoundé',
      region: CameroonRegion.CENTRE,
      town: 'Yaoundé',
      neighbourhood: 'Ngousso',
    },
    {
      email: 'admin@laquintinie-douala.cm',
      name: 'Hôpital Laquintinie de Douala',
      region: CameroonRegion.LITTORAL,
      town: 'Douala',
      neighbourhood: 'Akwa',
    },
    {
      email: 'admin@hopital-regional-bafoussam.cm',
      name: 'Hôpital Régional de Bafoussam',
      region: CameroonRegion.WEST,
      town: 'Bafoussam',
      neighbourhood: 'Centre-ville',
    },
    {
      email: 'admin@hopital-regional-bamenda.cm',
      name: 'Hôpital Régional de Bamenda',
      region: CameroonRegion.NORTH_WEST,
      town: 'Bamenda',
      neighbourhood: 'Up Station',
    },
    {
      email: 'admin@regional-hospital-buea.cm',
      name: 'Regional Hospital Buea',
      region: CameroonRegion.SOUTH_WEST,
      town: 'Buea',
      neighbourhood: 'Molyko',
    },
    {
      email: 'admin@hopital-regional-garoua.cm',
      name: 'Hôpital Régional de Garoua',
      region: CameroonRegion.NORTH,
      town: 'Garoua',
      neighbourhood: 'Plateau',
    },
    {
      email: 'admin@hopital-regional-maroua.cm',
      name: 'Hôpital Régional de Maroua',
      region: CameroonRegion.FAR_NORTH,
      town: 'Maroua',
      neighbourhood: 'Domayo',
    },
    {
      email: 'admin@hopital-regional-bertoua.cm',
      name: 'Hôpital Régional de Bertoua',
      region: CameroonRegion.EAST,
      town: 'Bertoua',
      neighbourhood: 'Centre administratif',
    },
    {
      email: 'admin@hopital-regional-ngaoundere.cm',
      name: 'Hôpital Régional de Ngaoundéré',
      region: CameroonRegion.ADAMAWA,
      town: 'Ngaoundéré',
      neighbourhood: 'Joli-soir',
    },
    {
      email: 'admin@hopital-regional-ebolowa.cm',
      name: "Hôpital Régional d'Ebolowa",
      region: CameroonRegion.SOUTH,
      town: 'Ebolowa',
      neighbourhood: 'Centre-ville',
    },
  ];

  const hospitals: Hospital[] = [];
  for (const h of hospitalData) {
    const user = await prisma.user.upsert({
      where: { email: h.email },
      update: { authProvider: 'local' },
      create: {
        email: h.email,
        passwordHash: await hash('Hospital@123'),
        role: 'HOSPITAL',
        authProvider: 'local',
        hospital: {
          create: {
            name: h.name,
            phone: nextPhone(),
            region: h.region,
            town: h.town,
            neighbourhood: h.neighbourhood,
            licenseNumber: `MSP/${h.town.substring(0, 3).toUpperCase()}/001`,
            latitude: 3.8 + Math.random(),
            longitude: 11.5 + Math.random(),
          },
        },
      },
      include: { hospital: true },
    });
    if (user.hospital) hospitals.push(user.hospital);
    console.log(`  ✅ Hospital [${h.region}]: ${h.name}`);
  }

  // 2. BLOOD BANKS (10 total)
  const bloodBankData = [
    {
      email: 'admin@cnts-yaounde.cm',
      name: 'CNTS Yaoundé',
      region: CameroonRegion.CENTRE,
      town: 'Yaoundé',
      contact: 'M. Atangana',
    },
    {
      email: 'admin@cts-douala.cm',
      name: 'CTS Douala',
      region: CameroonRegion.LITTORAL,
      town: 'Douala',
      contact: 'Mme Bella',
    },
    {
      email: 'admin@cts-buea.cm',
      name: 'CTS Buea',
      region: CameroonRegion.SOUTH_WEST,
      town: 'Buea',
      contact: 'Mr. Ndive',
    },
    {
      email: 'admin@cts-bamenda.cm',
      name: 'CTS Bamenda',
      region: CameroonRegion.NORTH_WEST,
      town: 'Bamenda',
      contact: 'Mr. Fon',
    },
    {
      email: 'admin@cts-bafoussam.cm',
      name: 'CTS Bafoussam',
      region: CameroonRegion.WEST,
      town: 'Bafoussam',
      contact: 'M. Nana',
    },
    {
      email: 'admin@cts-garoua.cm',
      name: 'CTS Garoua',
      region: CameroonRegion.NORTH,
      town: 'Garoua',
      contact: 'M. Issa',
    },
    {
      email: 'admin@cts-maroua.cm',
      name: 'CTS Maroua',
      region: CameroonRegion.FAR_NORTH,
      town: 'Maroua',
      contact: 'M. Yerima',
    },
    {
      email: 'admin@cts-bertoua.cm',
      name: 'CTS Bertoua',
      region: CameroonRegion.EAST,
      town: 'Bertoua',
      contact: 'M. Ondoua',
    },
    {
      email: 'admin@cts-ngaoundere.cm',
      name: 'CTS Ngaoundéré',
      region: CameroonRegion.ADAMAWA,
      town: 'Ngaoundéré',
      contact: 'M. Adamou',
    },
    {
      email: 'admin@cts-ebolowa.cm',
      name: 'CTS Ebolowa',
      region: CameroonRegion.SOUTH,
      town: 'Ebolowa',
      contact: 'M. Essono',
    },
  ];

  const bloodBanks: BloodBank[] = [];
  for (const bb of bloodBankData) {
    const phone = nextPhone();
    const user = await prisma.user.upsert({
      where: { email: bb.email },
      update: { authProvider: 'local' },
      create: {
        email: bb.email,
        passwordHash: await hash('BloodBank@123'),
        role: 'BLOOD_BANK',
        authProvider: 'local',
        bloodBank: {
          create: {
            name: bb.name,
            phone,
            region: bb.region,
            town: bb.town,
            contactName: bb.contact,
            languagePreference:
              bb.region === CameroonRegion.SOUTH_WEST ||
              bb.region === CameroonRegion.NORTH_WEST
                ? 'EN'
                : 'FR',
            conversationState: BloodBankConversationState.IDLE,
          },
        },
      },
      include: { bloodBank: true },
    });
    if (user.bloodBank) {
      bloodBanks.push(user.bloodBank);
      // Registry
      await prisma.phoneNumberRegistry.upsert({
        where: { phone: formatForRegistry(phone) },
        update: { entityId: user.bloodBank.id },
        create: {
          phone: formatForRegistry(phone),
          entityType: 'BLOOD_BANK',
          entityId: user.bloodBank.id,
        },
      });
    }
    console.log(`  ✅ Blood Bank [${bb.region}]: ${bb.name}`);
  }

  // 3. DOCTORS (20 total)
  const doctorData = [
    { name: 'Dr. Mbarga Emile', spec: 'Chirurgie', reg: 'CMC-001', hIdx: 0 },
    {
      name: 'Dr. Talla Hyacinthe',
      spec: 'Urgentologie',
      reg: 'CMC-003',
      hIdx: 1,
    },
    { name: 'Dr. Fon Wirba', spec: 'Pédiatrie', reg: 'CMC-007', hIdx: 3 },
    { name: 'Dr. Epie Ndive', spec: 'Orthopédie', reg: 'CMC-009', hIdx: 4 },
  ];
  // Fill the rest with placeholders to match 20
  for (let i = 4; i < 20; i++) {
    doctorData.push({
      name: `Dr. Doc${i}`,
      spec: 'General Medicine',
      reg: `CMC-0${i + 10}`,
      hIdx: i % 10,
    });
  }

  for (const d of doctorData) {
    const email = `doctor.${d.reg.toLowerCase()}@sangroot.cm`;
    await prisma.user.upsert({
      where: { email },
      update: { authProvider: 'local' },
      create: {
        email,
        passwordHash: await hash('Doctor@123'),
        role: 'DOCTOR',
        authProvider: 'local',
        doctor: {
          create: {
            name: d.name,
            phone: nextPhone(),
            specialization: d.spec,
            registrationNo: d.reg,
            hospitalId: hospitals[d.hIdx].id,
          },
        },
      },
    });
    console.log(`  ✅ Doctor: ${d.name}`);
  }

  // 4. DONORS (120 total)
  const donorNames = [
    'Manga Jean-Pierre',
    'Bella Thérèse',
    'Nana Gilles',
    'Fon Emmanuel',
    'Ndive John',
    'Issa Maïgari',
    'Moussa Yerima',
    'Ondoua Félix',
    'Bello Adamou',
    'Essono Martin',
    'Abena Stéphane',
    'Kollo Xavier',
  ];

  for (let i = 0; i < 120; i++) {
    const hIdx = i % 10;
    const hospital = hospitals[hIdx];
    const phone = donorPhone();
    const name = i < donorNames.length ? donorNames[i] : `Donor ${i}`;

    const donor = await prisma.donor.upsert({
      where: { phone },
      update: {
        preferredName: name.split(' ')[0],
        onboardingComplete: i < 10,
      },
      create: {
        name,
        preferredName: name.split(' ')[0],
        phone,
        email: `donor${i}@sangroot.cm`,
        dateBirth: birthDate(),
        bloodGroup: randomBloodGroup(),
        region: hospital.region,
        town: hospital.town,
        genre: randomGender(),
        hospitalId: hospital.id,
        languagePreference:
          hospital.region === CameroonRegion.SOUTH_WEST ||
          hospital.region === CameroonRegion.NORTH_WEST
            ? 'EN'
            : 'FR',
        conversationState:
          i < 10
            ? DonorConversationState.IDLE
            : DonorConversationState.ONBOARDING,
        onboardingComplete: i < 10,
      },
    });

    // Registry
    await prisma.phoneNumberRegistry.upsert({
      where: { phone: formatForRegistry(phone) },
      update: { entityId: donor.id },
      create: {
        phone: formatForRegistry(phone),
        entityType: 'DONOR',
        entityId: donor.id,
      },
    });
  }
  console.log('  ✅ 120 donors created with v2 profile and registry');

  // 5. BLOOD REQUESTS
  const hospitalUsers = await prisma.user.findMany({
    where: { role: 'HOSPITAL' },
    select: { id: true },
  });

  for (let i = 0; i < 20; i++) {
    const user = hospitalUsers[i % hospitalUsers.length];
    const hospital = hospitals[i % 10];
    const status =
      i % 5 === 0 ? RequestStatus.IN_PROGRESS : RequestStatus.PENDING;

    const request = await prisma.bloodRequest.create({
      data: {
        requesterId: user.id,
        bloodGroup: randomBloodGroup(),
        unitsRequired: (i % 3) + 1,
        urgency: RequestUrgency.URGENT,
        status,
        patientName: `Patient ${i}`,
        patientAge: 25 + i,
        patientGender: Gender.MALE,
        hospitalName: hospital.name,
        region: hospital.region,
        town: hospital.town,
        requiredBy: daysFromNow(1),
        medicalReason: 'Severe Anemia',
      },
    });

    if (status === RequestStatus.IN_PROGRESS) {
      await prisma.outreachTask.create({
        data: {
          requestId: request.id,
          status: OutreachTaskStatus.IN_PROGRESS,
          donorsContacted: 5,
          banksContacted: 2,
        },
      });
    }
  }
  console.log('  ✅ 20 blood requests created + v2 outreach tasks');

  console.log('\n🎉 V2 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
