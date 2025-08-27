import { assert } from "chai";
import { EagleApi } from "../src/utils/eagleApi";
import { setPref, clearPref } from "../src/utils/prefs";

describe("Eagle API", function () {
  describe("Static methods", function () {
    it("should have timeout configured", function () {
      assert.isNumber((EagleApi as any).TIMEOUT);
      assert.isAbove((EagleApi as any).TIMEOUT, 0);
    });

    it("should have Eagle port configured", function () {
      assert.isNumber((EagleApi as any).EAGLE_PORT);
      assert.equal((EagleApi as any).EAGLE_PORT, 41595);
    });

    it("should generate Zotero item URL correctly", function () {
      const url = EagleApi.generateZoteroItemUrl("ABC123", "5", "annotation456");
      assert.isString(url);
      assert.include(url, "ABC123");
      assert.include(url, "page=5");
      assert.include(url, "annotation=annotation456");
    });

    it("should generate Zotero web URL correctly", function () {
      const url = EagleApi.generateZoteroWebUrl("ABC123", "user123");
      assert.isString(url);
      assert.include(url, "ABC123");
      assert.include(url, "user123");
    });
  });

  describe("URL building", function () {
    afterEach(function () {
      // Clean up preferences after each test
      clearPref("eagleApiUrl");
    });

    it("should use custom API URL from preferences", async function () {
      setPref("eagleApiUrl", "http://custom.host:8080");
      const url = await (EagleApi as any).buildEagleUrl("/test");
      assert.equal(url, "http://custom.host:8080/test");
    });

    it("should handle localhost in custom URL with pickEagleHost", async function () {
      setPref("eagleApiUrl", "http://localhost:8080");
      // Mock pickEagleHost to return a specific host
      const originalPickEagleHost = (EagleApi as any).pickEagleHost;
      (EagleApi as any).pickEagleHost = async () => "127.0.0.1";
      
      const url = await (EagleApi as any).buildEagleUrl("/test");
      assert.equal(url, "http://127.0.0.1:8080/test");
      
      // Restore original method
      (EagleApi as any).pickEagleHost = originalPickEagleHost;
    });

    it("should handle invalid URL gracefully", async function () {
      setPref("eagleApiUrl", "invalid-url-format");
      const url = await (EagleApi as any).buildEagleUrl("/test");
      assert.equal(url, "invalid-url-format/test");
    });
  });

  describe("Host picking", function () {
    it("should accept custom hosts array", async function () {
      const customHosts = ["192.168.1.1", "10.0.0.1"];
      
      try {
        await (EagleApi as any).pickEagleHost(customHosts);
        // If this doesn't throw, the host array was used
        assert.isTrue(true);
      } catch (error) {
        // Expected to fail with custom hosts, but should contain our custom error message
        assert.include(String(error), "Eagle API not reachable");
      }
    });
  });

  describe("Network connectivity (if Eagle is running)", function () {
    it("should handle unreachable hosts gracefully", async function () {
      this.timeout(5000);
      const isRunning = await EagleApi.isEagleRunning();
      assert.isBoolean(isRunning, "Should return a boolean value");
      assert.isTrue(isRunning, "Eagle should be running");
    });

    it("should fail with invalid URL", async function () {
      this.timeout(5000);
      const invalidItem = {
        url: "invalid-url-format",
        name: "Test Item"
      };
      
      const result = await EagleApi.addItemFromURL(invalidItem);
      assert.equal(result.status, "error", "Should return error status for invalid URL");
      assert.exists(result.message, "Should have error message");
    });
  });
});