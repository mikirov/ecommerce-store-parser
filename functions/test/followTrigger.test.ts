import { Done } from "mocha";
const test = require('firebase-functions-test')({
    databaseURL: 'https://social-ocean-6d649.firebaseio.com',
    storageBucket: 'social-ocean-6d649.appspot.com',
    projectId: 'social-ocean-6d649',
}, './firebase-service-account.json');



describe('Our follow trigger', function() {
    // Called once before any of the tests in this block begin.
    before((done: Done) => {
        done();
    });


    it('should increment follower and following counts on user collection', function(done) {

    });

    after((done: Done) => {
        test.cleanup();
        done();
    })
});
