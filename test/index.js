import {createApp} from "../src";

import request from 'supertest';

describe('Our server', function() {
    let app;

    // Called once before any of the tests in this block begin.
    before(function(done) {
        app = createApp();
        app.listen(function(err) {
            if (err) { return done(err); }
            done();
        });
    });


    it('should send back a JSON object with goodCall set to true', function() {
        request(app)
            .put('/domain')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .send({domainUri: "https://drinkpurerose.com/"})
            .expect(200, function(err, res) {
                if (err) { return done(err); }
                const callStatus = res.body.goodCall;
                expect(callStatus).to.equal(true);
                // Done
                done();
            });
    });

});
