const LoveLoader = () => {


    return (
        <div className="w-full z-100 min-h-screen flex justify-center items-center fixed bg-white-30 bg-opacity-10 backdrop-blur-xl">
            <div className="absolute p-20 rounded-full border-t-8 border-red-600 animate-spin"></div>
            <img src="/icon.png" alt="Logo" className="w-20 h-20"/>
        </div>
    )
}

export default LoveLoader