/**
 * SangRoot Database Seed Script
 * ─────────────────────────────
 * Covers ALL 10 Cameroonian regions with realistic data.
 * Team phone numbers rotate across every entity type.
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
  Doctor,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  pool: { ssl: { rejectUnauthorized: false } },
});

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
 * Used for Hospitals, Blood Banks and Doctors (no uniqueness constraint).
 */
function nextPhone(): string {
  return TEAM_PHONES[globalPhoneIdx++ % TEAM_PHONES.length];
}

/**
 * Returns a phone number for a Donor.
 * - The first 6 donors each receive one real team number (exact, no changes).
 * - Donors 7 and beyond get a sequential placeholder (+237600000001 …)
 *   because the DB enforces @unique on donor.phone.
 */
let donorPhoneIdx = 0;
function donorPhone(): string {
  if (donorPhoneIdx < TEAM_PHONES.length) {
    return TEAM_PHONES[donorPhoneIdx++];
  }
  // placeholder — clearly fake, safe for DB uniqueness
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

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
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

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding database — all 10 Cameroonian regions…\n');

  // ══════════════════════════════════════════════════════════════════════════
  // 1. HOSPITALS  (one per region = 10 total)
  // ══════════════════════════════════════════════════════════════════════════
  const hospitalData = [
    // ── Already seeded regions ──────────────────────────────────────────────
    {
      email: 'admin@hopital-central-yaounde.cm',
      name: 'Hôpital Central de Yaoundé',
      region: CameroonRegion.CENTRE,
      town: 'Yaoundé',
      neighbourhood: 'Ngousso',
      licenseNumber: 'MSP/YDE/001',
      latitude: 3.8634,
      longitude: 11.5162,
    },
    {
      email: 'admin@laquintinie-douala.cm',
      name: 'Hôpital Laquintinie de Douala',
      region: CameroonRegion.LITTORAL,
      town: 'Douala',
      neighbourhood: 'Akwa',
      licenseNumber: 'MSP/DLA/002',
      latitude: 4.0511,
      longitude: 9.7679,
    },
    {
      email: 'admin@hopital-regional-bafoussam.cm',
      name: 'Hôpital Régional de Bafoussam',
      region: CameroonRegion.WEST,
      town: 'Bafoussam',
      neighbourhood: 'Centre-ville',
      licenseNumber: 'MSP/BFS/003',
      latitude: 5.4774,
      longitude: 10.4175,
    },
    // ── New regions ─────────────────────────────────────────────────────────
    {
      email: 'admin@hopital-regional-bamenda.cm',
      name: 'Hôpital Régional de Bamenda',
      region: CameroonRegion.NORTH_WEST,
      town: 'Bamenda',
      neighbourhood: 'Up Station',
      licenseNumber: 'MSP/BAM/004',
      latitude: 5.9631,
      longitude: 10.1591,
    },
    {
      email: 'admin@regional-hospital-buea.cm',
      name: 'Regional Hospital Buea',
      region: CameroonRegion.SOUTH_WEST,
      town: 'Buea',
      neighbourhood: 'Molyko',
      licenseNumber: 'MSP/BUE/005',
      latitude: 4.1527,
      longitude: 9.2417,
    },
    {
      email: 'admin@hopital-regional-garoua.cm',
      name: 'Hôpital Régional de Garoua',
      region: CameroonRegion.NORTH,
      town: 'Garoua',
      neighbourhood: 'Plateau',
      licenseNumber: 'MSP/GAR/006',
      latitude: 9.3016,
      longitude: 13.3956,
    },
    {
      email: 'admin@hopital-regional-maroua.cm',
      name: 'Hôpital Régional de Maroua',
      region: CameroonRegion.FAR_NORTH,
      town: 'Maroua',
      neighbourhood: 'Domayo',
      licenseNumber: 'MSP/MAR/007',
      latitude: 10.5955,
      longitude: 14.3156,
    },
    {
      email: 'admin@hopital-regional-bertoua.cm',
      name: 'Hôpital Régional de Bertoua',
      region: CameroonRegion.EAST,
      town: 'Bertoua',
      neighbourhood: 'Centre administratif',
      licenseNumber: 'MSP/BER/008',
      latitude: 4.5858,
      longitude: 13.683,
    },
    {
      email: 'admin@hopital-regional-ngaoundere.cm',
      name: 'Hôpital Régional de Ngaoundéré',
      region: CameroonRegion.ADAMAWA,
      town: 'Ngaoundéré',
      neighbourhood: 'Joli-soir',
      licenseNumber: 'MSP/NGD/009',
      latitude: 7.3239,
      longitude: 13.5843,
    },
    {
      email: 'admin@hopital-regional-ebolowa.cm',
      name: "Hôpital Régional d'Ebolowa",
      region: CameroonRegion.SOUTH,
      town: 'Ebolowa',
      neighbourhood: 'Centre-ville',
      licenseNumber: 'MSP/EBO/010',
      latitude: 2.9,
      longitude: 11.15,
    },
  ];

  const hospitals: Hospital[] = [];

  for (const h of hospitalData) {
    const user = await prisma.user.upsert({
      where: { email: h.email },
      update: {},
      create: {
        email: h.email,
        passwordHash: await hash('Hospital@123'),
        role: 'HOSPITAL',
        hospital: {
          create: {
            name: h.name,
            phone: nextPhone(),
            region: h.region,
            town: h.town,
            neighbourhood: h.neighbourhood,
            licenseNumber: h.licenseNumber,
            latitude: h.latitude,
            longitude: h.longitude,
          },
        },
      },
      include: { hospital: true },
    });
    if (user.hospital) hospitals.push(user.hospital);
    console.log(`  ✅ Hospital [${h.region}]: ${h.name}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. BLOOD BANKS  (one per region = 10 total)
  // ══════════════════════════════════════════════════════════════════════════
  const bloodBankData = [
    {
      email: 'admin@cnts-yaounde.cm',
      name: 'Centre National de Transfusion Sanguine – Yaoundé',
      region: CameroonRegion.CENTRE,
      town: 'Yaoundé',
      neighbourhood: 'Bastos',
      licenseNumber: 'CNTS/YDE/001',
      latitude: 3.8754,
      longitude: 11.5163,
    },
    {
      email: 'admin@cts-douala.cm',
      name: 'Centre de Transfusion Sanguine de Douala',
      region: CameroonRegion.LITTORAL,
      town: 'Douala',
      neighbourhood: 'Bonamoussadi',
      licenseNumber: 'CTS/DLA/001',
      latitude: 4.0611,
      longitude: 9.7589,
    },
    {
      email: 'admin@cts-buea.cm',
      name: 'Centre de Transfusion Sanguine de Buea',
      region: CameroonRegion.SOUTH_WEST,
      town: 'Buea',
      neighbourhood: 'Great Soppo',
      licenseNumber: 'CTS/BUE/001',
      latitude: 4.1527,
      longitude: 9.2417,
    },
    {
      email: 'admin@cts-bamenda.cm',
      name: 'Centre de Transfusion Sanguine de Bamenda',
      region: CameroonRegion.NORTH_WEST,
      town: 'Bamenda',
      neighbourhood: 'Commercial Avenue',
      licenseNumber: 'CTS/BAM/002',
      latitude: 5.9597,
      longitude: 10.1448,
    },
    {
      email: 'admin@cts-bafoussam.cm',
      name: 'Centre de Transfusion Sanguine de Bafoussam',
      region: CameroonRegion.WEST,
      town: 'Bafoussam',
      neighbourhood: 'Tamdja',
      licenseNumber: 'CTS/BFS/003',
      latitude: 5.4747,
      longitude: 10.4117,
    },
    {
      email: 'admin@cts-garoua.cm',
      name: 'Centre de Transfusion Sanguine de Garoua',
      region: CameroonRegion.NORTH,
      town: 'Garoua',
      neighbourhood: 'Yelwa',
      licenseNumber: 'CTS/GAR/004',
      latitude: 9.2935,
      longitude: 13.396,
    },
    {
      email: 'admin@cts-maroua.cm',
      name: 'Centre de Transfusion Sanguine de Maroua',
      region: CameroonRegion.FAR_NORTH,
      town: 'Maroua',
      neighbourhood: 'Doualaré',
      licenseNumber: 'CTS/MAR/005',
      latitude: 10.5908,
      longitude: 14.325,
    },
    {
      email: 'admin@cts-bertoua.cm',
      name: 'Centre de Transfusion Sanguine de Bertoua',
      region: CameroonRegion.EAST,
      town: 'Bertoua',
      neighbourhood: 'Haoussa',
      licenseNumber: 'CTS/BER/006',
      latitude: 4.576,
      longitude: 13.691,
    },
    {
      email: 'admin@cts-ngaoundere.cm',
      name: 'Centre de Transfusion Sanguine de Ngaoundéré',
      region: CameroonRegion.ADAMAWA,
      town: 'Ngaoundéré',
      neighbourhood: 'Dang',
      licenseNumber: 'CTS/NGD/007',
      latitude: 7.3261,
      longitude: 13.5921,
    },
    {
      email: 'admin@cts-ebolowa.cm',
      name: "Centre de Transfusion Sanguine d'Ebolowa",
      region: CameroonRegion.SOUTH,
      town: 'Ebolowa',
      neighbourhood: 'Nkoelon',
      licenseNumber: 'CTS/EBO/008',
      latitude: 2.9025,
      longitude: 11.1519,
    },
  ];

  const bloodBanks: BloodBank[] = [];

  for (const bb of bloodBankData) {
    const user = await prisma.user.upsert({
      where: { email: bb.email },
      update: {},
      create: {
        email: bb.email,
        passwordHash: await hash('BloodBank@123'),
        role: 'BLOOD_BANK',
        bloodBank: {
          create: {
            name: bb.name,
            phone: nextPhone(),
            region: bb.region,
            town: bb.town,
            neighbourhood: bb.neighbourhood,
            licenseNumber: bb.licenseNumber,
            latitude: bb.latitude,
            longitude: bb.longitude,
          },
        },
      },
      include: { bloodBank: true },
    });
    if (user.bloodBank) bloodBanks.push(user.bloodBank);
    console.log(`  ✅ Blood Bank [${bb.region}]: ${bb.name}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. DOCTORS  (2 per hospital = 20 total)
  // ══════════════════════════════════════════════════════════════════════════
  const doctorData = [
    // CENTRE
    { name: 'Dr. Mbarga Emile', spec: 'Chirurgie', reg: 'CMC-001', hIdx: 0 },
    {
      name: 'Dr. Ngo Biyong Aline',
      spec: 'Cardiologie',
      reg: 'CMC-002',
      hIdx: 0,
    },
    // LITTORAL
    {
      name: 'Dr. Talla Hyacinthe',
      spec: 'Urgentologie',
      reg: 'CMC-003',
      hIdx: 1,
    },
    {
      name: 'Dr. Kamga Aurelien',
      spec: 'Hématologie',
      reg: 'CMC-004',
      hIdx: 1,
    },
    // WEST
    {
      name: 'Dr. Njoya Blaise',
      spec: 'Médecine interne',
      reg: 'CMC-005',
      hIdx: 2,
    },
    {
      name: 'Dr. Abena Christelle',
      spec: 'Gynécologie',
      reg: 'CMC-006',
      hIdx: 2,
    },
    // NORTH_WEST
    {
      name: 'Dr. Fon Wirba Emmanuel',
      spec: 'Pédiatrie',
      reg: 'CMC-007',
      hIdx: 3,
    },
    {
      name: 'Dr. Tabi Grace Akum',
      spec: 'Chirurgie générale',
      reg: 'CMC-008',
      hIdx: 3,
    },
    // SOUTH_WEST
    {
      name: 'Dr. Epie Ndive John',
      spec: 'Orthopédie',
      reg: 'CMC-009',
      hIdx: 4,
    },
    {
      name: 'Dr. Mbu Forbin Rita',
      spec: 'Anesthésiologie',
      reg: 'CMC-010',
      hIdx: 4,
    },
    // NORTH
    {
      name: 'Dr. Issa Maïgari',
      spec: 'Infectiologie',
      reg: 'CMC-011',
      hIdx: 5,
    },
    {
      name: 'Dr. Fadimatou Bello',
      spec: 'Gynécologie',
      reg: 'CMC-012',
      hIdx: 5,
    },
    // FAR_NORTH
    {
      name: 'Dr. Moussa Yerima',
      spec: 'Médecine interne',
      reg: 'CMC-013',
      hIdx: 6,
    },
    {
      name: 'Dr. Aissatou Bouba',
      spec: 'Urgentologie',
      reg: 'CMC-014',
      hIdx: 6,
    },
    // EAST
    { name: 'Dr. Ondoua Félix', spec: 'Chirurgie', reg: 'CMC-015', hIdx: 7 },
    {
      name: 'Dr. Ngono Blandine',
      spec: 'Cardiologie',
      reg: 'CMC-016',
      hIdx: 7,
    },
    // ADAMAWA
    { name: 'Dr. Bello Adamou', spec: 'Pédiatrie', reg: 'CMC-017', hIdx: 8 },
    { name: 'Dr. Haoua Garba', spec: 'Hématologie', reg: 'CMC-018', hIdx: 8 },
    // SOUTH
    { name: 'Dr. Essono Martin', spec: 'Orthopédie', reg: 'CMC-019', hIdx: 9 },
    { name: 'Dr. Mvondo Cécile', spec: 'Gynécologie', reg: 'CMC-020', hIdx: 9 },
  ];

  const doctors: Doctor[] = [];

  for (const d of doctorData) {
    const email = `doctor.${d.reg.toLowerCase()}@sangroot.cm`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await hash('Doctor@123'),
        role: 'DOCTOR',
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
      include: { doctor: true },
    });
    if (user.doctor) doctors.push(user.doctor);
    console.log(`  ✅ Doctor: ${d.name} — ${d.spec}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. DONORS  (8 per hospital = 80 total, spread across all regions)
  // ══════════════════════════════════════════════════════════════════════════
  const hospitalDonorGroups: {
    names: string[];
    region: CameroonRegion;
    towns: string[];
  }[] = [
    {
      region: CameroonRegion.CENTRE,
      towns: ['Yaoundé', 'Soa', 'Mfou', 'Obala'],
      names: [
        'Manga Jean-Pierre',
        'Owona Célestine',
        'Atangana Paul',
        'Essama Brigitte',
        'Nkodo Simon',
        'Biyong Marie-Claire',
        'Tsala Henri',
        'Mba Rose',
      ],
    },
    {
      region: CameroonRegion.LITTORAL,
      towns: ['Douala', 'Edéa', 'Mbanga', 'Loum'],
      names: [
        'Njike Claude',
        'Bella Thérèse',
        'Bona Arnaud',
        'Ekwalla Grace',
        'Ndoumbe Samuel',
        'Epale Justine',
        'Mbock Pierre',
        'Dissake Abigail',
      ],
    },
    {
      region: CameroonRegion.WEST,
      towns: ['Bafoussam', 'Dschang', 'Bangangté', 'Foumban'],
      names: [
        'Nana Gilles',
        'Fomekong Angèle',
        'Kamtchang David',
        'Ngouom Cécile',
        'Kenfack Rodrigue',
        'Mbouombouo Laure',
        'Tcheuko Bernard',
        'Wanko Solange',
      ],
    },
    {
      region: CameroonRegion.NORTH_WEST,
      towns: ['Bamenda', 'Kumbo', 'Wum', 'Fundong'],
      names: [
        'Fon Emmanuel',
        'Akum Grace',
        'Wirba Bih',
        'Nfor Thomas',
        'Fontem Juliet',
        'Tanyi Peter',
        'Sama Dorothy',
        'Yuh Collins',
      ],
    },
    {
      region: CameroonRegion.SOUTH_WEST,
      towns: ['Buea', 'Limbe', 'Kumba', 'Mundemba'],
      names: [
        'Ndive John',
        'Forbin Rita',
        'Epie Samuel',
        'Mbu Agnes',
        'Atem Victor',
        'Njie Patricia',
        'Oben Julius',
        'Eta Theresia',
      ],
    },
    {
      region: CameroonRegion.NORTH,
      towns: ['Garoua', 'Guider', 'Pitoa', 'Lagdo'],
      names: [
        'Issa Maïgari',
        'Fadimatou Bello',
        'Hamidou Sali',
        'Ramatou Haman',
        'Adjidjé Oumarou',
        'Fanta Bouba',
        'Daouda Waziri',
        'Mariama Djallo',
      ],
    },
    {
      region: CameroonRegion.FAR_NORTH,
      towns: ['Maroua', 'Kousseri', 'Mora', 'Yagoua'],
      names: [
        'Moussa Yerima',
        'Aissatou Bouba',
        'Alhadji Barka',
        'Hadja Fatimé',
        'Djibrine Oumar',
        'Fatime Mahamat',
        'Boukar Ali',
        'Mariam Abba',
      ],
    },
    {
      region: CameroonRegion.EAST,
      towns: ['Bertoua', 'Batouri', 'Abong-Mbang', 'Yokadouma'],
      names: [
        'Ondoua Félix',
        'Ngono Blandine',
        'Zang Pierre',
        'Abomo Léonie',
        'Obame François',
        'Mvogo Sylvie',
        'Nkoa Augustin',
        'Medza Christine',
      ],
    },
    {
      region: CameroonRegion.ADAMAWA,
      towns: ['Ngaoundéré', 'Meiganga', 'Tibati', 'Banyo'],
      names: [
        'Bello Adamou',
        'Haoua Garba',
        'Modibo Hayatou',
        'Hindatou Yaya',
        'Oumarou Sanda',
        'Bintou Pate',
        'Hamidou Zoulkiflou',
        'Amina Bouba',
      ],
    },
    {
      region: CameroonRegion.SOUTH,
      towns: ['Ebolowa', 'Sangmélima', 'Ambam', 'Kribi'],
      names: [
        'Essono Martin',
        'Mvondo Cécile',
        'Mengue Apollinaire',
        'Mba Jeanne',
        'Abam Richard',
        'Essi Marguerite',
        'Mekongo Hilaire',
        'Ntoutoume Alice',
      ],
    },
  ];

  for (let hIdx = 0; hIdx < hospitals.length; hIdx++) {
    const hospital = hospitals[hIdx];
    const group = hospitalDonorGroups[hIdx];

    for (let i = 0; i < group.names.length; i++) {
      const phone = donorPhone();
      try {
        await prisma.donor.upsert({
          where: { phone },
          update: {},
          create: {
            name: group.names[i],
            phone,
            email: `${group.names[i].toLowerCase().replace(/[^a-z]/g, '.')}${hIdx}@gmail.com`,
            dateBirth: birthDate(),
            bloodGroup: randomBloodGroup(),
            region: group.region,
            town: group.towns[i % group.towns.length],
            neighbourhood: `Quartier ${i + 1}`,
            genre: randomGender(),
            hospitalId: hospital.id,
          },
        });
      } catch {
        console.warn(`  ⚠️  Skipped hospital donor: ${group.names[i]}`);
      }
    }
    console.log(`  ✅ 8 donors → ${hospital.name} [${group.region}]`);
  }

  // ── Blood-bank donors (4 per bank = 40 more) ──────────────────────────────
  const bbDonorGroups: {
    names: string[];
    region: CameroonRegion;
    town: string;
  }[] = [
    {
      region: CameroonRegion.CENTRE,
      town: 'Yaoundé',
      names: [
        'Eyinga Thomas',
        'Mendouga Félicité',
        'Abena Stéphane',
        'Ndzana Odette',
      ],
    },
    {
      region: CameroonRegion.LITTORAL,
      town: 'Douala',
      names: ['Kollo Xavier', 'Yomo Hélène', 'Mballa Roger', 'Epondo Claire'],
    },
    {
      region: CameroonRegion.SOUTH_WEST,
      town: 'Buea',
      names: ['Ndjié Achille', 'Bebe Suzanne', 'Ekoume Jonas', 'Agbor Lydia'],
    },
    {
      region: CameroonRegion.NORTH_WEST,
      town: 'Bamenda',
      names: [
        'Nde Bartholomew',
        'Nji Veronica',
        'Buh Nkwain',
        'Njila Christine',
      ],
    },
    {
      region: CameroonRegion.WEST,
      town: 'Bafoussam',
      names: [
        'Fopa Innocent',
        'Mabou Sandrine',
        'Sokeng Eric',
        'Kenne Viviane',
      ],
    },
    {
      region: CameroonRegion.NORTH,
      town: 'Garoua',
      names: ['Alioum Hassan', 'Rabi Bello', 'Garba Yusuf', 'Hadja Oumarou'],
    },
    {
      region: CameroonRegion.FAR_NORTH,
      town: 'Maroua',
      names: ['Malam Bakari', 'Hassia Moussa', 'Goni Abba', 'Ngoune Lawan'],
    },
    {
      region: CameroonRegion.EAST,
      town: 'Bertoua',
      names: ['Bikele Prosper', 'Bimogo Claire', 'Zame Gustave', 'Minyem Rose'],
    },
    {
      region: CameroonRegion.ADAMAWA,
      town: 'Ngaoundéré',
      names: ['Alim Vina', 'Doumara Fanta', 'Sali Bello', 'Pade Haoua'],
    },
    {
      region: CameroonRegion.SOUTH,
      town: 'Ebolowa',
      names: ['Nze Ondo Jules', 'Minko Mi-Obam', 'Afane Pierre', 'Ekang Marie'],
    },
  ];

  for (let bbIdx = 0; bbIdx < bloodBanks.length; bbIdx++) {
    const bloodBank = bloodBanks[bbIdx];
    const group = bbDonorGroups[bbIdx];

    for (let i = 0; i < group.names.length; i++) {
      const phone = donorPhone();
      try {
        await prisma.donor.upsert({
          where: { phone },
          update: {},
          create: {
            name: group.names[i],
            phone,
            email: `${group.names[i].toLowerCase().replace(/[^a-z]/g, '.')}bb${bbIdx}@gmail.com`,
            dateBirth: birthDate(),
            bloodGroup: randomBloodGroup(),
            region: group.region,
            town: group.town,
            neighbourhood: `Quartier ${i + 5}`,
            genre: randomGender(),
            bloodBankId: bloodBank.id,
          },
        });
      } catch {
        console.warn(`  ⚠️  Skipped blood-bank donor: ${group.names[i]}`);
      }
    }
    console.log(`  ✅ 4 donors → ${bloodBank.name} [${group.region}]`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. BLOOD REQUESTS  (30 — every region represented)
  // ══════════════════════════════════════════════════════════════════════════
  const hospitalUsers = await prisma.user.findMany({
    where: { role: 'HOSPITAL' },
    select: { id: true },
  });
  const doctorUsers = await prisma.user.findMany({
    where: { role: 'DOCTOR' },
    select: { id: true },
  });
  const requesters = [...hospitalUsers, ...doctorUsers];

  const requestLocations: {
    region: CameroonRegion;
    town: string;
    hospitalName: string;
  }[] = [
    {
      region: CameroonRegion.CENTRE,
      town: 'Yaoundé',
      hospitalName: 'Hôpital Central de Yaoundé',
    },
    {
      region: CameroonRegion.LITTORAL,
      town: 'Douala',
      hospitalName: 'Hôpital Laquintinie de Douala',
    },
    {
      region: CameroonRegion.WEST,
      town: 'Bafoussam',
      hospitalName: 'Hôpital Régional de Bafoussam',
    },
    {
      region: CameroonRegion.NORTH_WEST,
      town: 'Bamenda',
      hospitalName: 'Hôpital Régional de Bamenda',
    },
    {
      region: CameroonRegion.SOUTH_WEST,
      town: 'Buea',
      hospitalName: 'Regional Hospital Buea',
    },
    {
      region: CameroonRegion.NORTH,
      town: 'Garoua',
      hospitalName: 'Hôpital Régional de Garoua',
    },
    {
      region: CameroonRegion.FAR_NORTH,
      town: 'Maroua',
      hospitalName: 'Hôpital Régional de Maroua',
    },
    {
      region: CameroonRegion.EAST,
      town: 'Bertoua',
      hospitalName: 'Hôpital Régional de Bertoua',
    },
    {
      region: CameroonRegion.ADAMAWA,
      town: 'Ngaoundéré',
      hospitalName: 'Hôpital Régional de Ngaoundéré',
    },
    {
      region: CameroonRegion.SOUTH,
      town: 'Ebolowa',
      hospitalName: "Hôpital Régional d'Ebolowa",
    },
  ];

  const patientNames = [
    'Jean Tabi',
    'Marie Ngo',
    'Paul Bitang',
    'Sophie Defo',
    'Claude Bella',
    'Aline Tsala',
    'Pierre Manga',
    'Rose Owona',
    'Henri Nkodo',
    'Brigitte Zoa',
    'Simon Atangana',
    'Celeste Mba',
    'Eric Njike',
    'Justine Epale',
    'Bernard Kamga',
    'Fona Wirba',
    'Agnes Mbu',
    'Issa Hamidou',
    'Fatima Bouba',
    'Ondoua Serge',
    'Ngo Elisabeth',
    'Bello Sali',
    'Hawa Garba',
    'Zang Prosper',
    'Alice Ntoutoume',
    'Adama Oumarou',
    'Bintou Djibrilla',
    'Nze Obam',
    'Minko Pierre',
    'Mvondo Helene',
  ];

  const urgencies = [
    RequestUrgency.CRITICAL,
    RequestUrgency.URGENT,
    RequestUrgency.ROUTINE,
  ];
  const statuses = [
    RequestStatus.PENDING,
    RequestStatus.IN_PROGRESS,
    RequestStatus.FULFILLED,
    RequestStatus.CANCELLED,
    RequestStatus.EXPIRED,
  ];
  const medicalReasons = [
    'Accident de la route',
    'Intervention chirurgicale programmée',
    'Anémie sévère',
    'Accouchement par césarienne',
    'Cancer — chimiothérapie',
    'Drépanocytose',
    'Traumatisme crânien',
    'Hémorragie post-partum',
    'Insuffisance rénale aiguë',
    'Brûlures graves',
  ];

  for (let i = 0; i < 30; i++) {
    const requester = requesters[i % requesters.length];
    const loc = requestLocations[i % requestLocations.length];
    const createdDA = Math.floor(Math.random() * 30);
    const status = statuses[i % statuses.length];
    const urgency = urgencies[i % urgencies.length];

    await prisma.bloodRequest.create({
      data: {
        requesterId: requester.id,
        bloodGroup: randomBloodGroup(),
        unitsRequired: Math.floor(Math.random() * 4) + 1,
        urgency,
        status,
        patientName: patientNames[i],
        patientAge: 18 + Math.floor(Math.random() * 55),
        patientGender: randomGender(),
        hospitalName: loc.hospitalName,
        region: loc.region,
        town: loc.town,
        neighbourhood: `Quartier ${i + 1}`,
        requiredBy: createdDA < 3 ? daysFromNow(2) : daysAgo(createdDA - 3),
        medicalReason: medicalReasons[i % medicalReasons.length],
        aiProcessedAt:
          status !== RequestStatus.PENDING ? daysAgo(createdDA - 1) : null,
        donorsContacted:
          status === RequestStatus.FULFILLED
            ? Math.floor(Math.random() * 5) + 1
            : 0,
        notes: i % 4 === 0 ? 'Phénotype rare requis si possible' : null,
        createdAt: daysAgo(createdDA),
      },
    });
  }
  console.log('  ✅ 30 blood requests created (all 10 regions covered)');

  // ══════════════════════════════════════════════════════════════════════════
  // 6. HOSPITAL INVITES  (10 — 1 per hospital)
  // ══════════════════════════════════════════════════════════════════════════
  const inviteStatuses = [
    'PENDING',
    'PENDING',
    'ACCEPTED',
    'ACCEPTED',
    'PENDING',
    'REJECTED',
    'ACCEPTED',
    'CANCELLED',
    'PENDING',
    'ACCEPTED',
  ] as const;

  const firstHospitalUserId = (await prisma.user.findFirst({
    where: { role: 'HOSPITAL' },
  }))!.id;

  for (let i = 0; i < hospitals.length; i++) {
    const hospital = hospitals[i];
    const email = `dr.pending.invite${i + 1}@gmail.com`;
    const iStatus = inviteStatuses[i];

    try {
      await prisma.hospitalInvite.upsert({
        where: {
          hospitalId_doctorEmail: {
            hospitalId: hospital.id,
            doctorEmail: email,
          },
        },
        update: {},
        create: {
          hospitalId: hospital.id,
          doctorEmail: email,
          status: iStatus,
          invitedBy: firstHospitalUserId,
          acceptedAt: iStatus === 'ACCEPTED' ? daysAgo(5) : null,
        },
      });
    } catch {
      console.warn(`  ⚠️  Skipped invite for ${email}`);
    }
  }
  console.log('  ✅ 10 hospital invites created');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n🎉 Seed complete!');
  console.log('─────────────────────────────────────────────');
  console.log('  Hospitals   : 10  (one per region)');
  console.log('  Blood Banks : 10  (one per region)');
  console.log('  Doctors     : 20  (2 per hospital)');
  console.log('  Donors      : 120 (80 via hospitals + 40 via blood banks)');
  console.log('  Blood Reqs  : 30  (all regions represented)');
  console.log('  Invites     : 10');
  console.log('─────────────────────────────────────────────');
  console.log('  Passwords:');
  console.log('    Hospital  → Hospital@123');
  console.log('    BloodBank → BloodBank@123');
  console.log('    Doctor    → Doctor@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
