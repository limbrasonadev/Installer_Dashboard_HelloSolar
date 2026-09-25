const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== STARTING HELLO SOLAR INSTALLER DASHBOARD TESTS ===\n');

// 1. Check JSON validity
console.log('1. Checking JSON Files...');
const jsonFiles = [
    'assets/data/installer.json',
    'assets/data/installer_data.json',
    'assets/data/notifications_seed.json'
];

jsonFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        console.log(`   ✓ ${file} is valid JSON (${Array.isArray(parsed) ? parsed.length + ' items' : Object.keys(parsed).length + ' keys'})`);
    } catch (err) {
        console.error(`   ✗ Error parsing ${file}:`, err.message);
        process.exit(1);
    }
});

// 2. Syntax check JS files
console.log('\n2. Syntax checking JS files...');
const jsFiles = [
    'assets/js/installer_data.js',
    'assets/js/notifications.js',
    'assets/js/workspace.js'
];

jsFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        new vm.Script(code);
        console.log(`   ✓ ${file} syntax is clean`);
    } catch (err) {
        console.error(`   ✗ Syntax error in ${file}:`, err.message);
        process.exit(1);
    }
});

// 3. Test InstallerData reactive flow in simulated browser environment
console.log('\n3. Testing InstallerData logic...');
const mockStorage = {};
const mockLocalStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

const sandbox = {
    window: {},
    localStorage: mockLocalStorage,
    location: { protocol: 'file:' },
    console: console,
    Intl: Intl,
    Set: Set,
    Array: Array,
    Object: Object,
    JSON: JSON,
    Date: Date,
    String: String,
    Number: Number
};
sandbox.window = sandbox;

const installerDataCode = fs.readFileSync(path.join(__dirname, '..', 'assets/js/installer_data.js'), 'utf8');
vm.createContext(sandbox);
vm.runInContext(installerDataCode, sandbox);

const InstallerData = sandbox.InstallerData;
if (!InstallerData) {
    console.error('   ✗ InstallerData was not exported to window!');
    process.exit(1);
}
console.log('   ✓ InstallerData successfully initialized');

(async () => {
    await InstallerData.loadData();
    const initialJobs = InstallerData.getJobs();
    console.log(`   ✓ Loaded ${initialJobs.length} active jobs`);

    // Verify KPI counts
    const initialCounts = InstallerData.getKpiCounts();
    console.log('   ✓ Initial KPI counts:', initialCounts);

    if (initialCounts.newJobs !== 3) {
        console.error(`   ✗ Expected 3 newJobs, got ${initialCounts.newJobs}`);
        process.exit(1);
    }
    if (initialCounts.inProgress !== 2) {
        console.error(`   ✗ Expected 2 inProgress, got ${initialCounts.inProgress}`);
        process.exit(1);
    }
    if (initialCounts.maintenance !== 2) {
        console.error(`   ✗ Expected 2 maintenance, got ${initialCounts.maintenance}`);
        process.exit(1);
    }
    if (initialCounts.completed !== 2) {
        console.error(`   ✗ Expected 2 completed, got ${initialCounts.completed}`);
        process.exit(1);
    }
    console.log('   ✓ KPI categories match initial expectation (New: 3, In Progress: 2, Maintenance: 2, Completed: 2)');

    // Test getJobsByCategory
    const newJobsList = InstallerData.getJobsByCategory('new');
    console.log(`   ✓ getJobsByCategory('new') returned ${newJobsList.length} jobs:`, newJobsList.map(j => j.applicantId));
    const maintList = InstallerData.getJobsByCategory('maintenance');
    console.log(`   ✓ getJobsByCategory('maintenance') returned ${maintList.length} jobs:`, maintList.map(j => j.applicantId));

    // Test subscription
    let subscriptionTriggered = false;
    let lastEvent = null;
    const unsubscribe = InstallerData.subscribe((evt) => {
        subscriptionTriggered = true;
        lastEvent = evt;
    });

    // Test acceptJob flow
    console.log('\n4. Testing Accept Flow for APP-1024...');
    const acceptRes = InstallerData.acceptJob('APP-1024');
    if (!acceptRes.success) {
        console.error('   ✗ acceptJob failed:', acceptRes);
        process.exit(1);
    }
    console.log('   ✓ acceptJob returned success');
    if (!subscriptionTriggered || lastEvent?.type !== 'JOB_ACCEPTED') {
        console.error('   ✗ Subscription was not triggered for acceptJob!');
        process.exit(1);
    }
    console.log('   ✓ Subscriber successfully received event:', lastEvent);

    const countsAfterAccept = InstallerData.getKpiCounts();
    console.log('   ✓ Counts after accept:', countsAfterAccept);
    if (countsAfterAccept.newJobs !== 2) {
        console.error(`   ✗ Expected newJobs to decrease 3 -> 2, got ${countsAfterAccept.newJobs}`);
        process.exit(1);
    }
    if (countsAfterAccept.inProgress !== 3) {
        console.error(`   ✗ Expected inProgress to increase 2 -> 3, got ${countsAfterAccept.inProgress}`);
        process.exit(1);
    }
    const updatedJob = InstallerData.getJobById('APP-1024');
    if (updatedJob.status !== 'In Progress') {
        console.error(`   ✗ Expected APP-1024 status to be 'In Progress', got '${updatedJob.status}'`);
        process.exit(1);
    }
    console.log(`   ✓ APP-1024 status is now '${updatedJob.status}'`);

    // Verify APP-1024 no longer appears in getJobsByCategory('new')
    const newJobsAfterAccept = InstallerData.getJobsByCategory('new');
    if (newJobsAfterAccept.some(j => j.id === 'APP-1024')) {
        console.error('   ✗ APP-1024 should have disappeared from new jobs!');
        process.exit(1);
    }
    console.log('   ✓ APP-1024 immediately disappeared from New Jobs list');

    // Test declineJob flow
    console.log('\n5. Testing Decline Flow for APP-1035...');
    subscriptionTriggered = false;
    const declineRes = InstallerData.declineJob('APP-1035');
    if (!declineRes.success) {
        console.error('   ✗ declineJob failed:', declineRes);
        process.exit(1);
    }
    console.log('   ✓ declineJob returned success');
    if (!subscriptionTriggered || lastEvent?.type !== 'JOB_DECLINED') {
        console.error('   ✗ Subscription was not triggered for declineJob!');
        process.exit(1);
    }

    const countsAfterDecline = InstallerData.getKpiCounts();
    console.log('   ✓ Counts after decline:', countsAfterDecline);
    if (countsAfterDecline.newJobs !== 1) {
        console.error(`   ✗ Expected newJobs to decrease 2 -> 1, got ${countsAfterDecline.newJobs}`);
        process.exit(1);
    }
    const newJobsAfterDecline = InstallerData.getJobsByCategory('new');
    if (newJobsAfterDecline.some(j => j.id === 'APP-1035')) {
        console.error('   ✗ APP-1035 should have disappeared from new jobs list!');
        process.exit(1);
    }
    console.log('   ✓ APP-1035 immediately disappeared from New Jobs list');

    // Test badge rendering
    console.log('\n6. Testing Status Badges...');
    const maintenanceBadge = InstallerData.renderStatusBadge('Maintenance');
    const inProgressBadge = InstallerData.renderStatusBadge('In Progress');
    const completedBadge = InstallerData.renderStatusBadge('Completed');
    const newJobBadge = InstallerData.renderStatusBadge('New Job');

    console.log('   ✓ Maintenance Badge:', maintenanceBadge);
    console.log('   ✓ In Progress Badge:', inProgressBadge);
    console.log('   ✓ Completed Badge:   ', completedBadge);
    console.log('   ✓ New Job Badge:     ', newJobBadge);

    if (!maintenanceBadge.includes('badge-danger') || !maintenanceBadge.includes('Maintenance')) {
        console.error('   ✗ Maintenance badge incorrect');
        process.exit(1);
    }
    if (!inProgressBadge.includes('badge-progress') || !inProgressBadge.includes('In Progress')) {
        console.error('   ✗ In Progress badge incorrect');
        process.exit(1);
    }
    if (!completedBadge.includes('badge-success') || !completedBadge.includes('Completed')) {
        console.error('   ✗ Completed badge incorrect');
        process.exit(1);
    }
    if (!newJobBadge.includes('badge-new') || !newJobBadge.includes('New Job')) {
        console.error('   ✗ New Job badge incorrect');
        process.exit(1);
    }

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===\n');
})();
