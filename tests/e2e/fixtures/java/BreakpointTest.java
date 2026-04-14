/**
 * Breakpoint test program for E2E testing
 * Tests breakpoint functionality
 */
public class BreakpointTest {
    private int counter = 0;

    public static void main(String[] args) throws Exception {
        BreakpointTest test = new BreakpointTest();
        test.run();
    }

    public void run() throws Exception {
        System.out.println("Starting breakpoint test");

        // Line 15: First breakpoint location
        methodA();

        // Line 18: Second breakpoint location
        methodB();

        // Line 21: Third breakpoint location
        methodC();

        System.out.println("Breakpoint test completed");
    }

    private void methodA() {
        counter++; // Line 27
        System.out.println("methodA: counter = " + counter);
    }

    private void methodB() {
        counter += 2; // Line 32
        System.out.println("methodB: counter = " + counter);
    }

    private void methodC() {
        counter += 3; // Line 37
        System.out.println("methodC: counter = " + counter);
    }
}
