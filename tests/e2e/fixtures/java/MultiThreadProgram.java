/**
 * Multi-threaded Java program for E2E testing
 * Tests thread management and concurrent debugging
 */
public class MultiThreadProgram {
    public static void main(String[] args) throws Exception {
        System.out.println("Starting multi-thread program");

        Thread t1 = new Thread(() -> {
            for (int i = 0; i < 10; i++) {
                System.out.println("Thread 1: " + i);
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    break;
                }
            }
        }, "WorkerThread-1");

        Thread t2 = new Thread(() -> {
            for (int i = 0; i < 10; i++) {
                System.out.println("Thread 2: " + i);
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    break;
                }
            }
        }, "WorkerThread-2");

        Thread t3 = new Thread(() -> {
            for (int i = 0; i < 5; i++) {
                System.out.println("Thread 3: " + i);
                try {
                    Thread.sleep(200);
                } catch (InterruptedException e) {
                    break;
                }
            }
        }, "WorkerThread-3");

        // Start threads
        t1.start();
        t2.start();
        t3.start();

        // Wait for threads to complete
        t1.join();
        t2.join();
        t3.join();

        System.out.println("All threads completed");
    }
}
