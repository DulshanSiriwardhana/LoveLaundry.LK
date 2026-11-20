const WorkPage = () => {
    return (
        <section className="space-y-4">
            <h2 className="text-2xl font-bold">How the service works</h2>
            <ol className="space-y-4">
                <li className="rounded-xl border border-green-600 bg-white p-4">
                    <p className="font-semibold">1. Choose your service</p>
                    <p className="mt-1 text-sm">
                        Pick wash and fold, ironing, dry cleaning, or bulk hotel linen
                        washing. Each service is priced by the item and its fabric care
                        requirements.
                    </p>
                </li>
                <li className="rounded-xl border border-green-600 bg-white p-4">
                    <p className="font-semibold">2. Hand over the items</p>
                    <p className="mt-1 text-sm">
                        Drop your laundry at our Chilaw location or arrange a pickup.
                        Items are counted and sorted before washing so nothing is lost.
                    </p>
                </li>
                <li className="rounded-xl border border-green-600 bg-white p-4">
                    <p className="font-semibold">3. We clean and press</p>
                    <p className="mt-1 text-sm">
                        Garments and linen are washed, dried and pressed. Delicate
                        fabrics are separated for suitable care, and bulky hotel linen
                        is processed in labelled batches.
                    </p>
                </li>
                <li className="rounded-xl border border-green-600 bg-white p-4">
                    <p className="font-semibold">4. Collect fresh laundry</p>
                    <p className="mt-1 text-sm">
                        Orderly folded items are returned by delivery or collected at
                        the shop. For a pickup, call or WhatsApp +94 77 420 0919.
                    </p>
                </li>
            </ol>
        </section>
    );
};

export default WorkPage;
